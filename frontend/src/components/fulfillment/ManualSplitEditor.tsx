/**
 * ManualSplitEditor — the "Manual Override" half of the fulfillment screen.
 *
 * Shows every stocked line with the warehouses that hold it, and lets an
 * operator type the quantity to draw from each. Everything it enforces here is
 * re-enforced by the server (allocation ≤ line quantity, allocation ≤ live
 * stock); the point of validating in the browser is to explain the constraint
 * while it is being broken, not to be the check that matters.
 *
 * Leaving a line short is allowed on purpose — that is how an operator
 * deliberately backorders part of an order.
 */
import { useState } from 'react';
import { AlertTriangle, Check, RefreshCw, X } from 'lucide-react';
import type { DemandLine, StockRow } from '../../types/fulfillment';

interface Props {
  demandLines: DemandLine[];
  stock: StockRow[];
  /** Pre-fills the editor with the plan the engine recommended. */
  initial: Record<string, number>; // `${lineId}:${warehouseId}` → qty
  saving: boolean;
  onCancel: () => void;
  onSubmit: (allocations: Array<{ quotationLineId: string; warehouseId: string; quantity: number }>) => void;
}

const key = (lineId: string, warehouseId: string) => `${lineId}:${warehouseId}`;

export default function ManualSplitEditor({ demandLines, stock, initial, saving, onCancel, onSubmit }: Props) {
  const [draft, setDraft] = useState<Record<string, number>>(initial);

  const setQty = (lineId: string, warehouseId: string, raw: string) => {
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    setDraft((d) => ({ ...d, [key(lineId, warehouseId)]: n }));
  };

  /** Warehouses that actually hold this line's product — the only valid sources. */
  const sourcesFor = (line: DemandLine) => stock.filter((s) => s.productId === line.productId);

  // Summing over every stock row instead of this line's own sources would fold
  // in another product's warehouses. Their keys are unwritten today so it would
 // read zero, but it silently becomes wrong the moment two lines share a
 // warehouse — which is the normal case for a multi-product order.
 const allocatedFor = (line: DemandLine) =>
 sourcesFor(line).reduce((total, s) => total + (draft[key(line.quotationLineId, s.warehouseId)] ?? 0), 0);

 // A line can only be over-allocated, never "wrong" for being short.
 const overAllocated = demandLines.filter((l) => allocatedFor(l) > l.quantity);
 const overStock = demandLines.flatMap((l) =>
 sourcesFor(l).filter((s) => (draft[key(l.quotationLineId, s.warehouseId)] ?? 0) > s.available),
 );
 const totalAllocated = demandLines.reduce((n, l) => n + allocatedFor(l), 0);
 const blocked = overAllocated.length > 0 || overStock.length > 0 || totalAllocated === 0;

 const submit = () => {
 const allocations = demandLines.flatMap((line) =>
 sourcesFor(line)
 .map((s) => ({
 quotationLineId: line.quotationLineId,
 warehouseId: s.warehouseId,
 quantity: draft[key(line.quotationLineId, s.warehouseId)] ?? 0,
 }))
 .filter((a) => a.quantity > 0),
 );
 onSubmit(allocations);
 };

 return (
 <div className="rounded-md border border-hairline bg-cream p-5">
 <div className="flex items-center justify-between mb-4">
 <div>
 <p className="text-sm font-semibold text-link">Manual split</p>
 <p className="text-xs text-subtle mt-0.5">
 Set how many units come from each warehouse. Anything you leave short goes to backorder.
 </p>
 </div>
 <button
 onClick={onCancel}
 className="w-7 h-7 rounded-lg flex items-center justify-center text-subtle hover:text-ink hover:bg-soft transition"
 >
 <X size={14} />
 </button>
 </div>

 <div className="space-y-4">
 {demandLines.map((line) => {
 const sources = sourcesFor(line);
 const allocated = allocatedFor(line);
 const short = line.quantity - allocated;

 return (
 <div key={line.quotationLineId} className="rounded-lg border border-hairline bg-canvas p-4">
 <div className="flex items-baseline justify-between mb-3">
 <p className="text-sm font-medium text-ink">{line.productName}</p>
 <p className={`text-xs font-medium ${allocated > line.quantity ? 'text-coral' : short > 0 ? 'text-warning' : 'text-success'}`}>
 {allocated} / {line.quantity} allocated
 {short > 0 && allocated <= line.quantity && ` · ${short} to backorder`}
 {allocated > line.quantity && ` · ${allocated - line.quantity} over`}
 </p>
 </div>

 {sources.length === 0 ? (
 <p className="text-xs text-subtle">No warehouse currently holds this product.</p>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {sources.map((s) => {
 const value = draft[key(line.quotationLineId, s.warehouseId)] ?? 0;
 const over = value > s.available;
 return (
 <label
 key={s.warehouseId}
 className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
 over ? 'border-coral bg-coral/8' : 'border-hairline bg-soft'
 }`}
 >
 <span className="min-w-0">
 <span className="block text-xs font-medium text-ink truncate">{s.warehouseName}</span>
 <span className="block text-xs text-subtle">
 {s.available} in stock · {s.deliveryDays}d
 </span>
 </span>
 <input
 type="number"
 min={0}
 max={Math.min(s.available, line.quantity)}
 value={value}
 onChange={(e) => setQty(line.quotationLineId, s.warehouseId, e.target.value)}
 className="w-16 shrink-0 bg-canvas border border-hairline rounded-lg px-2 py-1.5 text-sm text-right text-ink focus:outline-none focus:border-ink transition"
 />
 </label>
 );
 })}
 </div>
 )}
 </div>
 );
 })}
 </div>

 {(overAllocated.length > 0 || overStock.length > 0) && (
 <div className="mt-4 flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg border bg-coral/8 border-coral/30 text-coral">
 <AlertTriangle size={12} className="mt-0.5 shrink-0" />
 <span>
 {overAllocated.length > 0 && 'A line is allocated more units than the quotation orders. '}
            {overStock.length > 0 && 'A warehouse is allocated more units than it holds.'}
          </span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-5">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm text-subtle hover:text-ink hover:bg-soft transition"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={blocked || saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-ink hover:bg-ink-active text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
          Confirm manual split
        </button>
      </div>
    </div>
  );
}
