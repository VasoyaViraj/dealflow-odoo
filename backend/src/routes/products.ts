/**
 * products.ts — Public authenticated route: list all active products.
 * Used by Sales Rep when creating a quotation (Phase 3).
 */
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.category, products.name);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [row] = await db.select().from(products).where(eq(products.id, req.params.id));
    if (!row) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
