/**
 * Blended discount risk score and approval-level resolution.
 */
import { describe, it, expect } from 'vitest';
import { assessRisk, type ApprovalRule } from '../riskPolicy.js';

/** The Phase 2 seeded approval ladder. */
const rules: ApprovalRule[] = [
  { riskScoreThreshold: '0', approvalLevel: 'NONE' },
  { riskScoreThreshold: '1', approvalLevel: 'SALES_MANAGER' },
  { riskScoreThreshold: '50', approvalLevel: 'FINANCE' },
];

describe('blendedRiskScore', () => {
  it('is zero when every line is within its limit', () => {
    const result = assessRisk(
      [
        { grossAmount: '2400.00', discountOverLimitPct: '0.00' },
        { grossAmount: '500.00', discountOverLimitPct: '0.00' },
      ],
      rules,
    );
    expect(result.blendedRiskScore).toBe('0.00');
    expect(result.requiresApproval).toBe(false);
    expect(result.requiredApprovalLevel).toBe('NONE');
  });

  /**
   * The worked example from the problem statement. A Gold customer is
   * "allowed 15%", yet one small SERVICES line at 18% against its own 10%
   * ceiling is enough to flag the whole quotation.
   */
  it('flags a single badly over-limit line even when it is small', () => {
    const result = assessRisk(
      [
        { grossAmount: '160000.00', discountOverLimitPct: '0.00' }, // Laptop 12% vs 15%
        { grossAmount: '20000.00', discountOverLimitPct: '8.00' },  // Setup  18% vs 10%
      ],
      rules,
    );

    expect(result.worstLineExcessPct).toBe('8.00');
    expect(result.orderExcessPct).toBe('0.89');   // 1,600 excess / 180,000
    expect(result.blendedRiskScore).toBe('8.89'); // 8.00 + 0.89
    expect(result.requiresApproval).toBe(true);
    expect(result.requiredApprovalLevel).toBe('SALES_MANAGER');
  });

  /**
   * The other failure mode: no single line looks alarming, but the giveaway
   * accumulates. The score must exceed the worst individual line so that this
   * pattern cannot slip through.
   */
  it('accumulates many slightly over-limit lines above the worst single line', () => {
    const many = assessRisk(
      [
        { grossAmount: '10000.00', discountOverLimitPct: '2.00' },
        { grossAmount: '10000.00', discountOverLimitPct: '3.00' },
        { grossAmount: '10000.00', discountOverLimitPct: '2.00' },
      ],
      rules,
    );
    expect(many.worstLineExcessPct).toBe('3.00');
    expect(many.orderExcessPct).toBe('2.33');
    expect(many.blendedRiskScore).toBe('5.33');
    expect(Number(many.blendedRiskScore)).toBeGreaterThan(Number(many.worstLineExcessPct));
  });

  it('is monotonic — a deeper discount can only raise the score', () => {
    const mild = assessRisk([{ grossAmount: '1000.00', discountOverLimitPct: '2.00' }], rules);
    const worse = assessRisk([{ grossAmount: '1000.00', discountOverLimitPct: '9.00' }], rules);
    expect(Number(worse.blendedRiskScore)).toBeGreaterThan(Number(mild.blendedRiskScore));
  });

  it('handles an empty quotation without dividing by zero', () => {
    const result = assessRisk([], rules);
    expect(result.blendedRiskScore).toBe('0.00');
    expect(result.requiredApprovalLevel).toBe('NONE');
  });
});

describe('approval level resolution', () => {
  it('picks the highest threshold the score reaches', () => {
    expect(assessRisk([{ grossAmount: '100', discountOverLimitPct: '0' }], rules)
      .requiredApprovalLevel).toBe('NONE');
    expect(assessRisk([{ grossAmount: '100', discountOverLimitPct: '3' }], rules)
      .requiredApprovalLevel).toBe('SALES_MANAGER');
    // 40 over on the only line → 40 + 40 = 80, past the FINANCE threshold of 50.
    expect(assessRisk([{ grossAmount: '100', discountOverLimitPct: '40' }], rules)
      .requiredApprovalLevel).toBe('FINANCE');
  });

  it('follows an admin retuning the ladder, with no code change', () => {
    const strict: ApprovalRule[] = [
      { riskScoreThreshold: '0', approvalLevel: 'NONE' },
      { riskScoreThreshold: '0.5', approvalLevel: 'FINANCE' },
    ];
    expect(assessRisk([{ grossAmount: '100', discountOverLimitPct: '1' }], strict)
      .requiredApprovalLevel).toBe('FINANCE');
  });

  /** Unknown configuration fails closed to NONE rather than inventing a level. */
  it('ignores an unrecognised approval level', () => {
    const bogus: ApprovalRule[] = [{ riskScoreThreshold: '0', approvalLevel: 'CEO_SIGNOFF' }];
    expect(assessRisk([{ grossAmount: '100', discountOverLimitPct: '5' }], bogus)
      .requiredApprovalLevel).toBe('NONE');
  });

  it('requires no approval when no rule matches at all', () => {
    expect(assessRisk([{ grossAmount: '100', discountOverLimitPct: '5' }], [])
      .requiredApprovalLevel).toBe('NONE');
  });
});
