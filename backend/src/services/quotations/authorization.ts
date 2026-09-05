/**
 * authorization.ts — who may see and change a quotation.
 *
 * Every rule here runs on the server for every operation (TRD §10). The client
 * never supplies salesRepId; it is always taken from the authenticated token.
 *
 * Read access
 *   ADMIN / SALES_MANAGER / FINANCE_OPERATIONS  every quotation (they review
 *                                               margin and approvals)
 *   SALES_REPRESENTATIVE                        quotations they own
 *   CUSTOMER                                    quotations raised for the
 *                                               customer account linked to
 *                                               their user, and only once the
 *                                               quotation has left DRAFT — a
 *                                               rep's unfinished draft is not
 *                                               an offer and must not leak to
 *                                               the buyer
 *
 * Write access
 *   ADMIN                                       any editable quotation
 *   SALES_REPRESENTATIVE                        their own editable quotations
 *   everyone else                               none
 *
 * Managers and finance are deliberately read-only in Phase 3. Their
 * approve / reject / return-for-revision powers arrive with the approval
 * workflow; granting edit rights now would let a reviewer silently rewrite a
 * rep's commercial terms with no audit of an approval decision.
 */
import type { AuthUser } from '../../middleware/auth.js';
import { QuotationError } from './errors.js';

export const ROLE = {
  CUSTOMER: 'CUSTOMER',
  SALES_REPRESENTATIVE: 'SALES_REPRESENTATIVE',
  SALES_MANAGER: 'SALES_MANAGER',
  FINANCE_OPERATIONS: 'FINANCE_OPERATIONS',
  ADMIN: 'ADMIN',
} as const;

/** Roles that see every quotation regardless of ownership. */
const OVERSIGHT_ROLES: string[] = [ROLE.ADMIN, ROLE.SALES_MANAGER, ROLE.FINANCE_OPERATIONS];

/** The minimal quotation shape the authorization rules need. */
export interface AuthorizableQuotation {
  salesRepId: string;
  status: string;
  /** users.id linked to the quotation's customer account, if any. */
  customerLinkedUserId: string | null;
}

export function canCreate(actor: AuthUser): boolean {
  return actor.role === ROLE.SALES_REPRESENTATIVE || actor.role === ROLE.ADMIN;
}

export function canRead(actor: AuthUser, quotation: AuthorizableQuotation): boolean {
  if (OVERSIGHT_ROLES.includes(actor.role)) return true;
  if (actor.role === ROLE.SALES_REPRESENTATIVE) return quotation.salesRepId === actor.id;
  if (actor.role === ROLE.CUSTOMER) {
    return quotation.customerLinkedUserId === actor.id && quotation.status !== 'DRAFT';
  }
  return false;
}

export function canMutate(actor: AuthUser, quotation: AuthorizableQuotation): boolean {
  if (actor.role === ROLE.ADMIN) return true;
  if (actor.role === ROLE.SALES_REPRESENTATIVE) return quotation.salesRepId === actor.id;
  return false;
}

/** Throws FORBIDDEN unless the actor may create quotations. */
export function assertCanCreate(actor: AuthUser): void {
  if (!canCreate(actor)) {
    throw new QuotationError(
      'FORBIDDEN',
      'Only sales representatives can create quotations',
    );
  }
}
