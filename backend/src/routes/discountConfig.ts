/**
 * discountConfig.ts — Public read of the full discount configuration.
 * The quotation risk engine (Phase 4) calls this to get:
 *   - per-tier discount limits
 *   - per-category discount limits
 *
 * These values are NEVER hardcoded in the frontend or engine code.
 * Admin changes via /api/v1/admin/discount-tiers propagate here immediately.
 */
import { Router } from 'express';
import { db } from '../db/index.js';
import { discountTierConfigs, categoryDiscountLimits } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  try {
    const [tierConfigs, categoryLimits] = await Promise.all([
      db.select().from(discountTierConfigs).orderBy(discountTierConfigs.tier),
      db.select().from(categoryDiscountLimits).orderBy(categoryDiscountLimits.category),
    ]);

    res.json({
      success: true,
      data: {
        tierConfigs,   // e.g. [{ tier: 'GOLD', maxDiscountPct: '15.00' }, ...]
        categoryLimits, // e.g. [{ category: 'HARDWARE', maxDiscountPct: '15.00' }, ...]
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
