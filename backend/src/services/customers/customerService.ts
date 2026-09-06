/**
 * customerService.ts — Single source of truth for creating a customer account
 * together with its portal (CUSTOMER-role) user.
 *
 * Both the sales route (POST /customers) and the admin route
 * (POST /admin/customers) call in here. They used to each carry their own
 * `createCustomerSchema`, which is how the sales one drifted onto a
 * STANDARD/PREMIUM/ENTERPRISE tier enum that the `customer_tier` pg enum
 * (BRONZE/SILVER/GOLD) rejects — every create from the sales workspace 400'd.
 *
 * There is no GUI anywhere for wiring an existing `users` row to a
 * `customers` row, so creation does it in one transaction and
 * `attachPortalUser` covers customers that predate the flow.
 */

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { and, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../../db/index.js';
import { customers, users } from '../../db/schema.js';

export const CUSTOMER_TIERS = ['BRONZE', 'SILVER', 'GOLD'] as const;

/**
 * HTML forms post "" for untouched inputs; treat that as absent rather than as
 * a value that fails `.min(1)`.
 */
const optionalText = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().min(1).optional(),
);

export const createCustomerSchema = z.object({
  /** Company / account name. */
  name: z.string().trim().min(1, 'Company name is required'),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  phone: optionalText,
  address: optionalText,
  tier: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.enum(CUSTOMER_TIERS).optional(),
  ),
  /** Portal contact. Falls back to splitting `name` when omitted. */
  contactFirstName: optionalText,
  contactLastName: optionalText,
  /** Omit to have one generated and returned once in the response. */
  password: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().min(8, 'Password must be at least 8 characters').optional(),
  ),
  /** Set false to record the account without portal access. */
  createPortalUser: z.coerce.boolean().optional().default(true),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const attachPortalUserSchema = createCustomerSchema
  .pick({ email: true, contactFirstName: true, contactLastName: true, password: true })
  .partial({ email: true });

/** Carries an HTTP status so routes can rethrow it verbatim. */
export class CustomerServiceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'CustomerServiceError';
  }
}

/** How the portal user on the returned customer came to be. */
export type PortalLinkage = 'CREATED' | 'LINKED' | 'NONE';

export interface CustomerWithPortalResult {
  customer: typeof customers.$inferSelect;
  portalUser: { id: string; email: string; firstName: string; lastName: string } | null;
  linkage: PortalLinkage;
  /** Only set when a user was created here — this is the one chance to show it. */
  generatedPassword: string | null;
}

function generatePassword(): string {
  // URL-safe base64 keeps it copy-pasteable; the suffix guarantees the mix of
  // classes any future password policy is likely to want.
  return `${randomBytes(9).toString('base64url')}A1!`;
}

/** "Acme Corp" → { firstName: 'Acme', lastName: 'Corp' }; used only as a fallback. */
function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || 'Contact',
  };
}

function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

function publicUser(row: typeof users.$inferSelect) {
  return { id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName };
}

/**
 * Resolve the portal user for `email`: reuse an unlinked CUSTOMER user if one
 * exists, otherwise report what needs to happen. Refuses to hijack a staff
 * login or steal another customer's portal account.
 */
async function resolveExistingPortalUser(email: string, ignoreCustomerId?: string) {
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (!existing) return null;

  if (existing.role !== 'CUSTOMER') {
    throw new CustomerServiceError(
      `That email already belongs to a ${existing.role.replace(/_/g, ' ').toLowerCase()} account, so it cannot be used for a customer portal login.`,
      409,
    );
  }

  const [alreadyLinked] = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(
      ignoreCustomerId
        ? and(eq(customers.linkedUserId, existing.id), ne(customers.id, ignoreCustomerId))
        : eq(customers.linkedUserId, existing.id),
    );

  if (alreadyLinked) {
    // Customer names are not unique, so name alone can read as nonsense when
    // two records share one — include the id the admin can actually act on.
    throw new CustomerServiceError(
      `Portal login ${email} is already linked to customer "${alreadyLinked.name}" (${alreadyLinked.id}).`,
      409,
    );
  }

  return existing;
}

/**
 * Creates the `customers` row and, unless `createPortalUser` is false, the
 * `users` row it links to — both inside one transaction so a failure on either
 * side leaves nothing behind.
 */
export async function createCustomerWithPortalUser(
  input: CreateCustomerInput,
): Promise<CustomerWithPortalResult> {
  const { name, email, phone, address, tier, contactFirstName, contactLastName, password } = input;

  if (!input.createPortalUser) {
    const [customer] = await db
      .insert(customers)
      .values({
        name,
        email,
        phone: phone ?? null,
        address: address ?? null,
        tier: tier ?? 'BRONZE',
        isActive: true,
      })
      .returning();
    return { customer, portalUser: null, linkage: 'NONE', generatedPassword: null };
  }

  // `customers.email` has no unique index and duplicates exist in practice, so
  // this is deliberately only checked on the portal path: a login has to map to
  // exactly one customer, but two contact-only records may share an address.
  const [duplicate] = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(sql`lower(${customers.email}) = ${email}`);
  if (duplicate) {
    throw new CustomerServiceError(
      `Customer "${duplicate.name}" already uses ${email}, so a portal login for it would be ambiguous. Link the login to that customer instead, or save this one without portal access.`,
      409,
    );
  }

  const existingUser = await resolveExistingPortalUser(email);

  const fallback = splitName(name);
  const firstName = contactFirstName ?? fallback.firstName;
  const lastName = contactLastName ?? fallback.lastName;

  // Only generated when we actually mint a new login; linking an existing user
  // must not reset the password they already have.
  const plainPassword = existingUser ? null : password ?? generatePassword();
  const passwordHash = plainPassword ? await hashPassword(plainPassword) : null;

  return db.transaction(async (tx) => {
    let portalUser = existingUser;

    if (!portalUser) {
      [portalUser] = await tx
        .insert(users)
        .values({
          email,
          passwordHash: passwordHash!,
          firstName,
          lastName,
          role: 'CUSTOMER',
          status: 'ACTIVE',
        })
        .returning();
    }

    const [customer] = await tx
      .insert(customers)
      .values({
        name,
        email,
        phone: phone ?? null,
        address: address ?? null,
        tier: tier ?? 'BRONZE',
        isActive: true,
        linkedUserId: portalUser.id,
      })
      .returning();

    return {
      customer,
      portalUser: publicUser(portalUser),
      linkage: existingUser ? ('LINKED' as const) : ('CREATED' as const),
      // Echoed once so the caller can hand the credentials over; never stored.
      generatedPassword: password ? null : plainPassword,
    };
  });
}

/**
 * Gives an existing customer a portal login — the repair path for rows created
 * before this flow existed. Defaults to the customer's own email.
 *
 * Unlike creation, this does not reject an email another customer record also
 * uses: the admin is pointing at one specific row, so there is nothing to
 * disambiguate. A second row sharing that email then hits the already-linked
 * guard in resolveExistingPortalUser, which names the customer that won.
 */
export async function attachPortalUser(
  customerId: string,
  input: z.infer<typeof attachPortalUserSchema>,
): Promise<CustomerWithPortalResult> {
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (!customer) throw new CustomerServiceError('Customer not found.', 404);
  if (customer.linkedUserId) {
    throw new CustomerServiceError('This customer already has a portal login.', 409);
  }

  const email = (input.email ?? customer.email).trim().toLowerCase();
  const existingUser = await resolveExistingPortalUser(email, customerId);

  const fallback = splitName(customer.name);
  const firstName = input.contactFirstName ?? fallback.firstName;
  const lastName = input.contactLastName ?? fallback.lastName;

  const plainPassword = existingUser ? null : input.password ?? generatePassword();
  const passwordHash = plainPassword ? await hashPassword(plainPassword) : null;

  return db.transaction(async (tx) => {
    let portalUser = existingUser;

    if (!portalUser) {
      [portalUser] = await tx
        .insert(users)
        .values({
          email,
          passwordHash: passwordHash!,
          firstName,
          lastName,
          role: 'CUSTOMER',
          status: 'ACTIVE',
        })
        .returning();
    }

    const [updated] = await tx
      .update(customers)
      .set({ linkedUserId: portalUser.id, updatedAt: new Date() })
      .where(eq(customers.id, customerId))
      .returning();

    return {
      customer: updated,
      portalUser: publicUser(portalUser),
      linkage: existingUser ? ('LINKED' as const) : ('CREATED' as const),
      generatedPassword: input.password ? null : plainPassword,
    };
  });
}

/** Flattens a zod error into one sentence — routes return strings, not trees. */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ');
}
