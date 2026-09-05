/**
 * calculator.ts — the pure quotation calculation engine.
 *
 * This module has NO database, HTTP or Drizzle dependency. It takes fully
 * resolved line inputs plus the quotation-level discount and returns every
 * derived value. That is what makes it deterministic and idempotent
 * (PRD acceptance criterion 10): the same inputs always produce byte-identical
 * output, so `POST /quotations/:id/recalculate` can be run any number of times
 * without drift.
 *
 * ── Formulas ────────────────────────────────────────────────────────────────
 *
 * Per line (FR-05):
 *   grossAmount     = quantity × unitPrice
 *   discountAmount  = grossAmount × discountPct / 100
 *   finalPrice      = grossAmount − discountAmount
 *   cost            = quantity × unitCost
 *   margin          = finalPrice − cost
 *
 * The quotation-level discount is then spread across lines in proportion to
 * their finalPrice, giving each line a taxable base:
 *   allocatedDiscountAmount = quotationDiscountAmount × finalPrice / Σ finalPrice
 *   netAmount               = finalPrice − allocatedDiscountAmount
 *   taxAmount               = netAmount × taxRate / 100
 *   lineTotal               = netAmount + taxAmount
 *
 * Tax is computed per line rather than once on the order because taxRate is a
 * per-product column — a quotation mixing 18% hardware with 5% services has no
 * single "the tax rate". Summing per-line tax is the only formulation that
 * stays correct for a mixed basket, and it collapses to FR-06's
 * `taxableAmount × rate` whenever every line shares one rate.
 *
 * Per quotation (FR-06):
 *   subtotal                = Σ grossAmount
 *   lineDiscountAmount      = Σ discountAmount
 *   quotationDiscountAmount = (subtotal − lineDiscountAmount) × quotationDiscountPct / 100
 *   discountAmount          = lineDiscountAmount + quotationDiscountAmount
 *   taxableAmount           = subtotal − discountAmount   ( = Σ netAmount )
 *   taxAmount               = Σ line taxAmount
 *   grandTotal              = taxableAmount + taxAmount
 *   totalCost               = Σ cost
 *   margin                  = taxableAmount − totalCost
 *   marginPct               = margin / taxableAmount × 100   (0 when taxable is 0)
 *
 * Note that `margin` is derived from taxableAmount, which EXCLUDES tax — tax
 * never contributes to margin (BUSINESS_RULES "Margin", PRD criterion 5).
 * The quotation-level discount is a genuine giveaway, so it reduces margin;
 * `line.margin` is deliberately the FR-05 pre-allocation figure, while
 * `line.netMargin` is the post-allocation figure that actually sums to the
 * quotation margin.
 */
import { dec, money, percent, pctOf, safeRatioPct, sum, Decimal } from './money.js';

/** Round a Decimal to the money policy and keep it as a Decimal. */
const m = (value: Decimal): Decimal => dec(money(value));

export type ProductCategory = 'HARDWARE' | 'SERVICES' | 'SUBSCRIPTION';

/** One line as handed to the calculator — all prices already resolved. */
export interface CalculatorLineInput {
  /** Opaque identifier echoed back so callers can match results to rows. */
  ref: string;
  category: ProductCategory;
  quantity: number;
  unitPrice: string;
  unitCost: string;
  taxRate: string;
  discountPct: string;
  /** Resolved discount ceiling for this line; used for governance, not clamping. */
  maxDiscountPct: string;
}

export interface CalculatorInput {
  lines: CalculatorLineInput[];
  quotationDiscountPct: string;
}

export interface CalculatedLine {
  ref: string;
  grossAmount: string;
  discountAmount: string;
  finalPrice: string;
  cost: string;
  margin: string;
  marginPct: string;
  allocatedDiscountAmount: string;
  netAmount: string;
  netMargin: string;
  taxAmount: string;
  lineTotal: string;
  maxDiscountPct: string;
  discountOverLimitPct: string;
}

export interface CalculatedTotals {
  subtotal: string;
  lineDiscountAmount: string;
  quotationDiscountAmount: string;
  discountAmount: string;
  taxableAmount: string;
  taxAmount: string;
  grandTotal: string;
  totalCost: string;
  margin: string;
  marginPct: string;
}

export interface CalculatedQuotation {
  lines: CalculatedLine[];
  totals: CalculatedTotals;
}

/** Intermediate, full-precision view of a line before allocation. */
interface Stage1 {
  input: CalculatorLineInput;
  gross: Decimal;
  discount: Decimal;
  finalPrice: Decimal;
  cost: Decimal;
  overLimit: Decimal;
}

export function calculateQuotation(input: CalculatorInput): CalculatedQuotation {
  // ── Stage 1: per-line gross, line discount, final price, cost ──────────────
  // Each monetary value is rounded to the cent as it is produced, and the next
  // step consumes the ROUNDED figure. That is what makes the returned document
  // internally consistent: a reader adding up the numbers they were shown gets
  // exactly the numbers they were shown. Carrying full precision forward and
  // rounding only at the end would let a line report gross 1.15, discount 0.12
  // and finalPrice 1.04 — three correct figures that do not subtract.
  const stage1: Stage1[] = input.lines.map((line) => {
    const gross = m(dec(line.quantity).times(dec(line.unitPrice)));
    const discount = m(pctOf(gross, line.discountPct));
    const overLimit = Decimal.max(0, dec(line.discountPct).minus(dec(line.maxDiscountPct)));
    return {
      input: line,
      gross,
      discount,
      finalPrice: gross.minus(discount),
      cost: m(dec(line.quantity).times(dec(line.unitCost))),
      overLimit,
    };
  });

  const finalPriceTotal = sum(stage1.map((s) => s.finalPrice));

  // ── Stage 2: quotation-level discount, rounded once at the order level ─────
  // Rounding here (rather than per line) is what makes the allocation below
  // add up exactly to the figure shown to the customer.
  const quotationDiscountTotal = m(pctOf(finalPriceTotal, input.quotationDiscountPct));

  // ── Stage 3: spread the order discount across lines by value ───────────────
  // Each line's share is rounded to the money policy; the final line carrying
  // value absorbs the rounding residue so Σ allocated === quotationDiscountTotal
  // to the cent. Without this, a 3-way split of ₹10.00 would lose a paisa and
  // taxableAmount would disagree with Σ netAmount.
  const allocations: Decimal[] = stage1.map(() => new Decimal(0));

  if (!quotationDiscountTotal.isZero() && !finalPriceTotal.isZero()) {
    const lastFundedIndex = findLastFundedIndex(stage1);
    let allocatedSoFar = new Decimal(0);

    stage1.forEach((s, i) => {
      if (i === lastFundedIndex) return; // handled after the loop
      if (s.finalPrice.isZero()) return;
      const share = m(quotationDiscountTotal.times(s.finalPrice).dividedBy(finalPriceTotal));
      allocations[i] = share;
      allocatedSoFar = allocatedSoFar.plus(share);
    });

    allocations[lastFundedIndex] = quotationDiscountTotal.minus(allocatedSoFar);
  }

  // ── Stage 4: per-line net, tax and margin ──────────────────────────────────
  const lines: CalculatedLine[] = stage1.map((s, i) => {
    const allocated = allocations[i];
    const net = s.finalPrice.minus(allocated);
    const tax = m(pctOf(net, s.input.taxRate));

    return {
      ref: s.input.ref,
      grossAmount: money(s.gross),
      discountAmount: money(s.discount),
      finalPrice: money(s.finalPrice),
      cost: money(s.cost),
      margin: money(s.finalPrice.minus(s.cost)),
      marginPct: percent(safeRatioPct(s.finalPrice.minus(s.cost), s.finalPrice)),
      allocatedDiscountAmount: money(allocated),
      netAmount: money(net),
      netMargin: money(net.minus(s.cost)),
      taxAmount: money(tax),
      lineTotal: money(net.plus(tax)),
      maxDiscountPct: percent(s.input.maxDiscountPct),
      discountOverLimitPct: percent(s.overLimit),
    };
  });

  // ── Stage 5: quotation totals ──────────────────────────────────────────────
  // Summing already-rounded line values means every identity in the header
  // comment holds to the cent, with no residual:
  //   taxableAmount === subtotal − discountAmount
  //   grandTotal    === taxableAmount + taxAmount
  const roundedSubtotal = sum(lines.map((l) => l.grossAmount));
  const roundedLineDiscount = sum(lines.map((l) => l.discountAmount));
  const discountTotal = roundedLineDiscount.plus(quotationDiscountTotal);
  const taxableAmount = sum(lines.map((l) => l.netAmount));
  const taxTotal = sum(lines.map((l) => l.taxAmount));
  const totalCost = sum(lines.map((l) => l.cost));
  const margin = taxableAmount.minus(totalCost);

  return {
    lines,
    totals: {
      subtotal: money(roundedSubtotal),
      lineDiscountAmount: money(roundedLineDiscount),
      quotationDiscountAmount: money(quotationDiscountTotal),
      discountAmount: money(discountTotal),
      taxableAmount: money(taxableAmount),
      taxAmount: money(taxTotal),
      grandTotal: money(taxableAmount.plus(taxTotal)),
      totalCost: money(totalCost),
      margin: money(margin),
      marginPct: percent(safeRatioPct(margin, taxableAmount)),
    },
  };
}

/** Last line with a non-zero final price — the rounding-residue absorber. */
function findLastFundedIndex(rows: Stage1[]): number {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!rows[i].finalPrice.isZero()) return i;
  }
  return rows.length - 1;
}
