/**
 * customers.ts — Authenticated route: list customers.
 * Sales reps need this to select a customer when creating a quotation.
 */
import { Router } from 'express';
import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { customers, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        tier: customers.tier,
        isActive: customers.isActive,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(eq(customers.isActive, true))
      .orderBy(customers.name);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [row] = await db.select().from(customers).where(eq(customers.id, String(req.params.id)));
    if (!row) return res.status(404).json({ success: false, error: 'Customer not found' });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
