import { Router } from 'express';
import { sql, eq, and, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { quotations, quotationLines, users, customers } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import ExcelJS from 'exceljs';

const router = Router();

async function buildReportFilters(queryObj: any) {
  const { startDate, endDate, salesRepId, status, category } = queryObj;
  const filters = [];
  if (startDate) filters.push(gte(quotations.createdAt, new Date(startDate as string)));
  if (endDate) {
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999);
    filters.push(lte(quotations.createdAt, end));
  }
  if (salesRepId) filters.push(eq(quotations.salesRepId, salesRepId as string));
  if (status) filters.push(eq(quotations.status, status as any));

  let isEmptyCategory = false;
  if (category) {
    const matchingQuotes = await db.select({ quotationId: quotationLines.quotationId })
      .from(quotationLines)
      .where(eq(quotationLines.category, category as any))
      .groupBy(quotationLines.quotationId);

    const matchingQuoteIds = matchingQuotes.map(q => q.quotationId);
    
    if (matchingQuoteIds.length > 0) {
      filters.push(inArray(quotations.id, matchingQuoteIds));
    } else {
      isEmptyCategory = true;
      filters.push(sql`1 = 0`);
    }
  }

  return { filters, isEmptyCategory };
}


// ─── GET /api/v1/reports ───────────────────────────────────────────────────
router.get('/', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { filters, isEmptyCategory } = await buildReportFilters(req.query);
    if (isEmptyCategory) {
      return res.json({
        success: true,
        data: {
          revenue: 0,
          quotes: 0,
          orders: 0,
          averageDiscount: 0,
          averageMargin: 0
        }
      });
    }

    let query = db.select({
      id: quotations.id,
      grandTotal: quotations.grandTotal,
      quotationDiscountPct: quotations.quotationDiscountPct,
      marginPercent: quotations.marginPercent,
      status: quotations.status,
    }).from(quotations);

    if (filters.length > 0) {
      query.where(and(...filters));

    }

    const rows = await query;

    let revenue = 0;
    let quotesCount = rows.length;
    let ordersCount = 0;
    let totalDiscount = 0;
    let totalMargin = 0;

    for (const r of rows) {
      if (r.status === 'CONFIRMED') {
        revenue += Number(r.grandTotal);
        ordersCount++;
      }
      totalDiscount += Number(r.quotationDiscountPct);
      totalMargin += Number(r.marginPercent);
    }

    const averageDiscount = quotesCount > 0 ? (totalDiscount / quotesCount).toFixed(2) : '0.00';
    const averageMargin = quotesCount > 0 ? (totalMargin / quotesCount).toFixed(2) : '0.00';

    res.json({
      success: true,
      data: {
        revenue,
        quotes: quotesCount,
        orders: ordersCount,
        averageDiscount,
        averageMargin
      }
    });
  } catch (err: any) {
    console.error('Reports error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── GET /api/v1/reports/export ─────────────────────────────────────────────
router.get('/export', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { filters } = await buildReportFilters(req.query);

    let query = db.select({
      quotationNumber: quotations.quotationNumber,
      customerName: customers.name,
      salesRepName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      status: quotations.status,
      grandTotal: quotations.grandTotal,
      marginPercent: quotations.marginPercent,
      quotationDiscountPct: quotations.quotationDiscountPct,
      createdAt: quotations.createdAt
    })
    .from(quotations)
    .leftJoin(customers, eq(quotations.customerId, customers.id))
    .leftJoin(users, eq(quotations.salesRepId, users.id));

    if (filters.length > 0) {
      query.where(and(...filters));
    }

    const rows = await query;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Analytics Report');

    worksheet.columns = [
      { header: 'Quotation #', key: 'quotationNumber', width: 15 },
      { header: 'Customer', key: 'customerName', width: 25 },
      { header: 'Sales Rep', key: 'salesRepName', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Grand Total', key: 'grandTotal', width: 15 },
      { header: 'Margin %', key: 'marginPercent', width: 10 },
      { header: 'Discount %', key: 'quotationDiscountPct', width: 12 },
      { header: 'Date', key: 'createdAt', width: 20 },
    ];

    worksheet.addRows(rows.map(r => ({
      ...r,
      createdAt: new Date(r.createdAt as any).toLocaleDateString()
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=dealflow360_analytics.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err: any) {
    console.error('Reports export error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
