import { Router } from 'express';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { quotations, users, customers } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// ─── GET /api/v1/dashboard/deal-health ─────────────────────────────────────────
router.get('/deal-health', requireAuth, requireRole(['SALES_MANAGER', 'ADMIN']), async (_req, res) => {
  try {
    const ACTIVE_STATUSES = [
      'DRAFT', 'SUBMITTED', 'RISK_CALCULATED',
      'PENDING_MANAGER', 'PENDING_FINANCE',
      'REVISION_REQUESTED', 'NEGOTIATION_REQUESTED',
      'APPROVED'
    ];

    // 1. Active Deals
    const activeDealsResult = await db.select({ count: sql<number>`count(*)` })
      .from(quotations)
      .where(inArray(quotations.status, ACTIVE_STATUSES as any));
    const activeDeals = Number(activeDealsResult[0]?.count || 0);

    // 2. Pending Approval
    const pendingApprovalResult = await db.select({ count: sql<number>`count(*)` })
      .from(quotations)
      .where(inArray(quotations.status, ['PENDING_MANAGER', 'PENDING_FINANCE'] as any));
    const pendingApproval = Number(pendingApprovalResult[0]?.count || 0);

    // 3. Stalled Deals (Inactive for > 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const stalledResult = await db.select({
      id: quotations.id,
      quotationNumber: quotations.quotationNumber,
      customerName: customers.name,
      updatedAt: quotations.updatedAt,
      daysInactive: sql<number>`DATE_PART('day', NOW() - ${quotations.updatedAt})`
    })
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .where(and(
        inArray(quotations.status, ACTIVE_STATUSES as any),
        sql`${quotations.updatedAt} < ${sevenDaysAgo}`
      ));

    // 4. Discount Anomalies
    // Compare current quotation discount to the rep's historical average.
    // We'll fetch all active quotes and compare them against rep averages.
    
    // Get rep averages
    const repAveragesResult = await db.select({
      salesRepId: quotations.salesRepId,
      avgDiscount: sql<number>`AVG(${quotations.quotationDiscountPct}::numeric)`
    })
    .from(quotations)
    .where(inArray(quotations.status, ['CONFIRMED', 'APPROVED'] as any)) // historical ones that succeeded
    .groupBy(quotations.salesRepId);

    const repAveragesMap = new Map(repAveragesResult.map(r => [r.salesRepId, Number(r.avgDiscount)]));

    // Fetch active quotes to check for anomalies
    const activeQuotesResult = await db.select({
      id: quotations.id,
      quotationNumber: quotations.quotationNumber,
      customerName: customers.name,
      salesRepId: quotations.salesRepId,
      salesRepName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      currentDiscount: quotations.quotationDiscountPct
    })
    .from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .leftJoin(users, eq(quotations.salesRepId, users.id))
    .where(inArray(quotations.status, ACTIVE_STATUSES as any));

    const anomalies = [];
    for (const quote of activeQuotesResult) {
      const repAvg = repAveragesMap.get(quote.salesRepId) || 0;
      const current = Number(quote.currentDiscount);
      // Anomaly if current discount is > 5% higher than their historical average
      if (current > repAvg + 5) {
        anomalies.push({
          ...quote,
          repAvg
        });
      }
    }

    res.json({
      success: true,
      data: {
        cards: {
          activeDeals,
          pendingApproval,
          stalled: stalledResult.length,
          atRisk: anomalies.length
        },
        stalledDeals: stalledResult,
        anomalies
      }
    });

  } catch (err: any) {
    console.error('Deal health error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
