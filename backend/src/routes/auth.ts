import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, refreshTokens, auditLogs } from '../db/schema';
import { requireAuth } from '../middleware/auth';

const router = Router();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'secret';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const signupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['CUSTOMER', 'SALES_REPRESENTATIVE', 'SALES_MANAGER', 'FINANCE_OPERATIONS', 'ADMIN']).optional(),
});

router.post('/signup', async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.format() });
    }

    const { firstName, lastName, email, password, role } = parsed.data;

    // BR-007: Admin accounts must not be created through unrestricted public signup.
    if (role === 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Cannot create ADMIN role via public signup' });
    }

    const existingUser = await db.select().from(users).where(eq(users.email, email));
    if (existingUser.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const defaultRole = role || 'CUSTOMER';

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        firstName,
        lastName,
        role: defaultRole as any,
        status: 'ACTIVE',
      })
      .returning();

    // Create Access Token
    const accessToken = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, status: newUser.status },
      JWT_ACCESS_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRES_IN as any }
    );

    // Create Refresh Token
    const plainRefreshToken = jwt.sign(
      { id: newUser.id },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as any }
    );
    const refreshTokenHash = await bcrypt.hash(plainRefreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(refreshTokens).values({
      userId: newUser.id,
      tokenHash: refreshTokenHash,
      expiresAt,
    });

    // Audit Log
    await db.insert(auditLogs).values({
      userId: newUser.id,
      action: 'USER_SIGNUP',
      entityType: 'USER',
      entityId: newUser.id,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
        },
        accessToken,
      },
    });
  } catch (err) {
    console.error('Signup error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.format() });
    }

    const { email, password } = parsed.data;

    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    // AUTH-007, BR-009: Generic authentication error
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // BR-004, BR-005: Status check
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, error: `Account is ${user.status.toLowerCase()}` });
    }

    // Update lastLoginAt
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    // Tokens
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, status: user.status },
      JWT_ACCESS_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRES_IN as any }
    );

    const plainRefreshToken = jwt.sign(
      { id: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as any }
    );
    const refreshTokenHash = await bcrypt.hash(plainRefreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt,
    });

    // Audit Log
    await db.insert(auditLogs).values({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        accessToken,
      },
    });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.userId, req.user!.id));

    await db.insert(auditLogs).values({
      userId: req.user!.id,
      action: 'USER_LOGOUT',
      entityType: 'USER',
      entityId: req.user!.id,
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, req.user!.id));

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
