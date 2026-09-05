/**
 * Calculation engine tests — TEST_PLAN §1 "Calculator".
 *
 * The seeded catalogue is used throughout so the numbers here are the same
 * ones the demo produces:
 *   Laptop        HARDWARE     price 1200, cost 800, tax 18%
 *   Setup Service SERVICES     price  500, cost 100, tax 18%
 *   Cloud Pro     SUBSCRIPTION price  200, cost  50, tax 18%
 */
import { describe, it, expect } from 'vitest';
import { calculateQuotation, type CalculatorLineInput } from '../calculator.js';

const laptop = (over: Partial<CalculatorLineInput> = {}): CalculatorLineInput => ({
  ref: 'laptop',
  category: 'HARDWARE',
  quantity: 2,
  unitPrice: '1200.00',
  unitCost: '800.00',
  taxRate: '18',
  discountPct: '0',
  maxDiscountPct: '15',
  ...over,
});

const setup = (over: Partial<CalculatorLineInput> = {}): CalculatorLineInput => ({
  ref: 'setup',
  category: 'SERVICES',
  quantity: 1,
  unitPrice: '500.00',
  unitCost: '100.00',
  taxRate: '18',
  discountPct: '0',
  maxDiscountPct: '10',
  ...over,
});

const calc = (lines: CalculatorLineInput[], quotationDiscountPct = '0') =>
  calculateQuotation({ lines, quotationDiscountPct });

describe('line calculation (FR-05)', () => {
  it('multiplies quantity by unit price', () => {
    const [line] = calc([laptop()]).lines;
    expect(line.grossAmount).toBe('2400.00');
  });

  it('derives discount amount, final price, cost and margin', () => {
    const [line] = calc([laptop({ discountPct: '10' })]).lines;
    expect(line.discountAmount).toBe('240.00'); // 2400 × 10%
    expect(line.finalPrice).toBe('2160.00');    // 2400 − 240
    expect(line.cost).toBe('1600.00');          // 2 × 800
    expect(line.margin).toBe('560.00');         // 2160 − 1600
    expect(line.marginPct).toBe('25.93');       // 560 / 2160
  });

  it('keeps each line internally consistent: gross − discount === finalPrice', () => {
    // 1.15 × 10% is 0.115 → 0.12, and 1.15 − 0.12 must be exactly 1.03.
    const [line] = calc([
      laptop({ quantity: 1, unitPrice: '1.15', unitCost: '0.50', discountPct: '10' }),
    ]).lines;
    expect(line.grossAmount).toBe('1.15');
    expect(line.discountAmount).toBe('0.12');
    expect(line.finalPrice).toBe('1.03');
    expect(Number(line.grossAmount) - Number(line.discountAmount)).toBeCloseTo(
      Number(line.finalPrice),
      2,
    );
  });
});

describe('quotation totals (FR-06)', () => {
  it('sums gross amounts into the subtotal', () => {
    const { totals } = calc([laptop(), setup()]);
    expect(totals.subtotal).toBe('2900.00');
  });

  it('applies tax after discounts and excludes it from margin', () => {
    const { totals } = calc([laptop({ discountPct: '10' }), setup({ discountPct: '20' })]);

    expect(totals.lineDiscountAmount).toBe('340.00');  // 240 + 100
    expect(totals.taxableAmount).toBe('2560.00');      // 2900 − 340
    expect(totals.taxAmount).toBe('460.80');           // 2560 × 18%
    expect(totals.grandTotal).toBe('3020.80');         // 2560 + 460.80
    expect(totals.totalCost).toBe('1700.00');
    expect(totals.margin).toBe('860.00');              // 2560 − 1700, NOT 3020.80 − 1700
    expect(totals.marginPct).toBe('33.59');
  });

  it('combines line discounts with the quotation-level discount', () => {
    const { totals, lines } = calc(
      [laptop({ discountPct: '10' }), setup({ discountPct: '20' })],
      '10',
    );

    expect(totals.quotationDiscountAmount).toBe('256.00'); // 2560 × 10%
    expect(totals.discountAmount).toBe('596.00');          // 340 + 256
    expect(totals.taxableAmount).toBe('2304.00');          // 2900 − 596
    expect(totals.taxAmount).toBe('414.72');
    expect(totals.grandTotal).toBe('2718.72');
    expect(totals.margin).toBe('604.00');
    expect(totals.marginPct).toBe('26.22');

    // The order discount is spread across lines in proportion to their value.
    expect(lines[0].allocatedDiscountAmount).toBe('216.00'); // 2160/2560 × 256
    expect(lines[1].allocatedDiscountAmount).toBe('40.00');  //  400/2560 × 256
    expect(lines[0].netAmount).toBe('1944.00');
    expect(lines[1].netAmount).toBe('360.00');
  });

  it('taxes each line at its own rate for a mixed-rate basket', () => {
    const { totals } = calc([
      laptop({ quantity: 1, taxRate: '18' }),        // 1200 → 216.00
      setup({ taxRate: '5' }),                       //  500 →  25.00
    ]);
    expect(totals.taxAmount).toBe('241.00');
    expect(totals.grandTotal).toBe('1941.00');
  });
});

describe('identities that must always hold', () => {
  const scenarios: Array<[string, CalculatorLineInput[], string]> = [
    ['no discounts', [laptop(), setup()], '0'],
    ['line discounts only', [laptop({ discountPct: '7.5' }), setup({ discountPct: '3' })], '0'],
    ['order discount only', [laptop(), setup()], '12.5'],
    ['both', [laptop({ discountPct: '11' }), setup({ discountPct: '18' })], '7.5'],
    ['awkward thirds', [
      laptop({ ref: 'a', quantity: 1, unitPrice: '10.00' }),
      laptop({ ref: 'b', quantity: 1, unitPrice: '10.00' }),
      laptop({ ref: 'c', quantity: 1, unitPrice: '10.00' }),
    ], '33.33'],
  ];

  it.each(scenarios)('%s: taxable === subtotal − discount, grand === taxable + tax', (_n, lines, qPct) => {
    const { totals, lines: out } = calc(lines, qPct);

    expect(Number(totals.taxableAmount)).toBeCloseTo(
      Number(totals.subtotal) - Number(totals.discountAmount), 2);
    expect(Number(totals.grandTotal)).toBeCloseTo(
      Number(totals.taxableAmount) + Number(totals.taxAmount), 2);
    expect(Number(totals.margin)).toBeCloseTo(
      Number(totals.taxableAmount) - Number(totals.totalCost), 2);

    // Allocation loses nothing to rounding.
    const allocated = out.reduce((a, l) => a + Number(l.allocatedDiscountAmount), 0);
    expect(allocated).toBeCloseTo(Number(totals.quotationDiscountAmount), 2);

    // Lines sum to the header.
    expect(out.reduce((a, l) => a + Number(l.netAmount), 0))
      .toBeCloseTo(Number(totals.taxableAmount), 2);
    expect(out.reduce((a, l) => a + Number(l.lineTotal), 0))
      .toBeCloseTo(Number(totals.grandTotal), 2);
  });

  it('absorbs the rounding residue on the last funded line', () => {
    // ₹10.00 split three ways would lose a paisa if each share were rounded
    // independently: 3.33 + 3.33 + 3.33 = 9.99.
    const { totals, lines } = calc([
      laptop({ ref: 'a', quantity: 1, unitPrice: '10.00' }),
      laptop({ ref: 'b', quantity: 1, unitPrice: '10.00' }),
      laptop({ ref: 'c', quantity: 1, unitPrice: '10.00' }),
    ], '33.33');

    expect(totals.quotationDiscountAmount).toBe('10.00');
    expect(lines.map((l) => l.allocatedDiscountAmount)).toEqual(['3.33', '3.33', '3.34']);
    expect(totals.taxableAmount).toBe('20.00');
  });
});

describe('edge cases', () => {
  it('returns all zeros for an empty quotation without dividing by zero', () => {
    const { totals, lines } = calc([]);
    expect(lines).toEqual([]);
    expect(totals).toMatchObject({
      subtotal: '0.00',
      discountAmount: '0.00',
      taxableAmount: '0.00',
      taxAmount: '0.00',
      grandTotal: '0.00',
      margin: '0.00',
      marginPct: '0.00',
    });
  });

  it('handles a 100% discount without a divide-by-zero margin percent', () => {
    const { totals, lines } = calc([laptop({ discountPct: '100' })]);
    expect(lines[0].finalPrice).toBe('0.00');
    expect(lines[0].marginPct).toBe('0.00');
    expect(totals.taxableAmount).toBe('0.00');
    expect(totals.margin).toBe('-1600.00'); // still sold at cost 1600
    expect(totals.marginPct).toBe('0.00');
  });

  it('skips zero-value lines when allocating the order discount', () => {
    const { lines, totals } = calc(
      [laptop({ ref: 'free', discountPct: '100' }), setup({ ref: 'paid' })],
      '10',
    );
    expect(lines[0].allocatedDiscountAmount).toBe('0.00');
    expect(lines[1].allocatedDiscountAmount).toBe('50.00'); // all of 500 × 10%
    expect(totals.quotationDiscountAmount).toBe('50.00');
  });

  it('is idempotent — identical inputs give identical output', () => {
    const lines = [laptop({ discountPct: '13' }), setup({ discountPct: '9' })];
    expect(calc(lines, '4.5')).toEqual(calc(lines, '4.5'));
  });
});

describe('discount limit reporting', () => {
  it('records how far past its ceiling each line went, without clamping', () => {
    const { lines } = calc([laptop({ discountPct: '12' }), setup({ discountPct: '18' })]);
    expect(lines[0].discountOverLimitPct).toBe('0.00');  // 12 within 15
    expect(lines[1].discountOverLimitPct).toBe('8.00');  // 18 against 10
    // The discount was applied in full — the engine flags, it does not clamp.
    expect(lines[1].discountAmount).toBe('90.00');       // 500 × 18%
  });
});
