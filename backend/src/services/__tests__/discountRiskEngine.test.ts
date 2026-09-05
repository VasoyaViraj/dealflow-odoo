import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { calculateRisk } from '../discountRiskEngine.js';
import {
  setupFixtures,
  teardownFixtures,
  createQuotation,
  type TestFixtures,
} from './testHelpers.js';

describe('discountRiskEngine.calculateRisk', () => {
  let fx: TestFixtures;

  beforeAll(async () => {
    fx = await setupFixtures();
  });

  afterAll(async () => {
    await teardownFixtures(fx);
  });

  it('matches DEMO_SCRIPT.md example 1: mixed line, one within ceiling, one over — riskScore 13.79', async () => {
    // Laptop x2 @ 12% (HARDWARE ceiling 15% -> within limit, deviation 0)
    // Setup Service x1 @ 18% (SERVICES ceiling min(GOLD 15, SERVICES 10) = 10% -> deviation 8)
    // totalLineValue = 2*1200 + 1*500 = 2900
    // weightedDeviationSum = 0 * (2400/2900) + 8 * (500/2900) = 1.37931...
    // riskScore = round(1.37931 * 10 * 100) / 100 = 13.79
    const quotationId = await createQuotation(fx, [
      { productId: fx.laptopId, quantity: 2, unitPrice: '1200.00', cost: '800.00', discountPercent: '12' },
      { productId: fx.setupServiceId, quantity: 1, unitPrice: '500.00', cost: '100.00', discountPercent: '18' },
    ]);

    const result = await calculateRisk(quotationId);

    expect(result.riskScore).toBe(13.79);
    expect(result.approvalRequired).toBe(true);
    expect(result.requiredLevel).toBe('SALES_MANAGER');
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].deviation).toBe(8);
  });

  it('matches DEMO_SCRIPT.md example 2: single line well over ceiling — riskScore 150, routes to FINANCE', async () => {
    // Setup Service x10 @ 25% (ceiling 10%, deviation 15), sole line so weight = 1
    // riskScore = round(15 * 1 * 10 * 100) / 100 = 150
    const quotationId = await createQuotation(fx, [
      { productId: fx.setupServiceId, quantity: 10, unitPrice: '500.00', cost: '100.00', discountPercent: '25' },
    ]);

    const result = await calculateRisk(quotationId);

    expect(result.riskScore).toBe(150);
    expect(result.approvalRequired).toBe(true);
    expect(result.requiredLevel).toBe('FINANCE');
  });

  it('effectiveAllowed = MIN(tierLimit, categoryLimit): a GOLD customer still can\'t exceed the tighter SERVICES ceiling', async () => {
    // GOLD tier allows 15%, but SERVICES category caps at 10% — the category
    // limit must win even though the customer's tier alone would allow more.
    const quotationId = await createQuotation(fx, [
      { productId: fx.setupServiceId, quantity: 1, unitPrice: '500.00', cost: '100.00', discountPercent: '12' },
    ]);

    const result = await calculateRisk(quotationId);

    // 12% actual vs effectiveAllowed = MIN(15, 10) = 10% -> deviation 2, not 0
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].allowedDiscount).toBe(10);
    expect(result.violations[0].deviation).toBe(2);
  });

  it('zero-deviation quotation requires no approval', async () => {
    const quotationId = await createQuotation(fx, [
      { productId: fx.laptopId, quantity: 1, unitPrice: '1200.00', cost: '800.00', discountPercent: '5' },
    ]);

    const result = await calculateRisk(quotationId);

    expect(result.riskScore).toBe(0);
    expect(result.approvalRequired).toBe(false);
    expect(result.requiredLevel).toBe('NONE');
    expect(result.violations).toHaveLength(0);
  });

  it('throws for a quotation that does not exist', async () => {
    await expect(calculateRisk('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/not found/);
  });
});
