/**
 * user.ts — Per-user settings and status routes.
 *
 * Base path: /api/v1/user
 *
 *   GET  /onboarding-status     returns { hasCompletedOnboarding }
 *   POST /onboarding-complete   sets hasCompletedOnboarding = true
 */
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

const router = Router();

router.use(requireAuth);

/** Return the onboarding completion flag for the authenticated user. */
router.get('/onboarding-status', async (req, res) => {
  try {
    const [row] = await db
      .select({ hasCompletedOnboarding: users.hasCompletedOnboarding })
      .from(users)
      .where(eq(users.id, req.user!.id));

    if (!row) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({
      success: true,
      data: { hasCompletedOnboarding: row.hasCompletedOnboarding },
    });
  } catch (err) {
    console.error('Failed to fetch onboarding status', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/** Mark the authenticated user's onboarding as complete. */
router.post('/onboarding-complete', async (req, res) => {
  try {
    await db
      .update(users)
      .set({ hasCompletedOnboarding: true, updatedAt: new Date() })
      .where(eq(users.id, req.user!.id));

    return res.json({
      success: true,
      data: { hasCompletedOnboarding: true },
    });
  } catch (err) {
    console.error('Failed to complete onboarding', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
