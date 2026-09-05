import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../lib/api';
import { getProducts } from '../../lib/referenceData';
import {
  ArrowLeft, ShoppingCart, Package, RefreshCw,
  Trash2, AlertTriangle, CheckCircle, Send, Plus, Star, Info, FileText
} from 'lucide-react';
import type { Quotation, Product } from '../../types/quotation';
import { StatusBadge, CategoryBadge, RiskBadge } from '../ui/badges';
import { MarginBar } from './MarginBar';

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

export function QuotationBuilderView({
  initialQuotation,
  onBack,
  showToast,
}: {
  initialQuotation: Quotation;
  onBack: () => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [q, setQ] = useState<Quotation>(initialQuotation);
  const [products, setProducts] = useState<Product[]>([]);
  const [catFilter, setCatFilter] = useState<'ALL' | 'HARDWARE' | 'SERVICES' | 'SUBSCRIPTION'>('ALL');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);  // productId being added
  const [lineUpdating, setLineUpdating] = useState<string | null>(null); // lineId being updated
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notes, setNotes] = useState(initialQuotation.notes ?? '');
  const [orderDiscount, setOrderDiscount] = useState(initialQuotation.quotationDiscountPercent ?? '0');
  const notesTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isEditable = q.status === 'DRAFT';

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

  // ─ Product Catalogue helpers

  const filteredProducts = products.filter(p => {
    const matchCat = catFilter === 'ALL' || p.category === catFilter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const addedProductIds = new Set(q.lines.map(l => l.productId));

  // Upsell suggestions: products not in cart, prefer different categories
  const cartCategories = new Set(q.lines.map(l => l.category));
  const upsellSuggestions = products
    .filter(p => !addedProductIds.has(p.id))
    .sort((a, b) => {
      const aNew = !cartCategories.has(a.category) ? -1 : 1;
      const bNew = !cartCategories.has(b.category) ? -1 : 1;
      return aNew - bNew;
    })
    .slice(0, 3);

  // ─ Mutations

  const addProduct = async (productId: string) => {
    if (!isEditable) return;
    setAdding(productId);
    try {
      const r = await api.post(`/quotations/${q.id}/items`, { productId, quantity: 1, expectedVersion: q.version });
      setQ(r.data.data);
      showToast('Product added');
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? 'Failed to add product', 'error');
    } finally { setAdding(null); }
  };

  const updateLineQty = async (lineId: string, delta: number, current: number) => {
    if (!isEditable) return;
    const newQty = current + delta;
    if (newQty < 1) return;
    setLineUpdating(lineId);
    try {
      const r = await api.patch(`/quotations/${q.id}/items/${lineId}`, { quantity: newQty, expectedVersion: q.version });
      setQ(r.data.data);
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? 'Update failed', 'error');
    } finally { setLineUpdating(null); }
  };

  const updateLineDiscount = async (lineId: string, discountPercent: number) => {
    if (!isEditable) return;
    setLineUpdating(lineId);
    try {
      const r = await api.patch(`/quotations/${q.id}/items/${lineId}`, { discountPercent, expectedVersion: q.version });
      setQ(r.data.data);
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? 'Update failed', 'error');
    } finally { setLineUpdating(null); }
  };

  const removeLine = async (lineId: string) => {
    if (!isEditable) return;
    setLineUpdating(lineId);
    try {
      const r = await api.delete(`/quotations/${q.id}/items/${lineId}?expectedVersion=${q.version}`);
      setQ(r.data.data);
      showToast('Line removed');
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? 'Remove failed', 'error');
    } finally { setLineUpdating(null); }
  };

  const saveNotesAndDiscount = useCallback(async (notesVal: string, discountVal: string) => {
    if (!isEditable) return;
    try {
      const r = await api.patch(`/quotations/${q.id}`, {
        notes: notesVal.trim() || null,
        quotationDiscountPercent: parseFloat(discountVal) || 0,
        expectedVersion: q.version,
      });
      setQ(r.data.data);
    } catch { /* silently fail on auto-save */ }
  }, [q.id, q.version, isEditable]);

  const handleNotesChange = (v: string) => {
    setNotes(v);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => saveNotesAndDiscount(v, orderDiscount), 1000);
  };

  const handleDiscountBlur = () => saveNotesAndDiscount(notes, orderDiscount);

  const submitQuotation = async () => {
    if (q.lines.length === 0) { showToast('Add at least one product before submitting', 'error'); return; }
    setSubmitting(true);
    try {
      const r = await api.post(`/quotations/${q.id}/submit`, { expectedVersion: q.version });
      setQ(r.data.data);
      setSubmitted(true);
      showToast('Quotation submitted for approval');
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? 'Submit failed', 'error');
    } finally { setSubmitting(false); }
  };

  const marginPct = parseFloat(q.marginPercent) || 0;
  const riskScore = parseFloat(q.blendedRiskScore) || 0;

  return (
    <div className="flex flex-col h-full">
      {/* Builder header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-zinc-800 shrink-0 bg-zinc-950">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="w-px h-5 bg-zinc-800" />
          <div>
            <span className="text-xs text-zinc-500 font-mono">{q.quotationNumber}</span>
            <h1 className="text-base font-bold text-white leading-none mt-0.5">{q.customer?.name}</h1>
          </div>
          <StatusBadge status={q.status} />
          {riskScore >= 10 && <RiskBadge score={q.blendedRiskScore} />}
        </div>
        {isEditable && !submitted && (
          <button
            id="submit-quotation-btn"
            onClick={submitQuotation}
            disabled={submitting || q.lines.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-violet-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} /> {submitting ? 'Submitting…' : 'Submit for Approval'}
          </button>
        )}
        {!isEditable && (
          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Info size={13} /> Read-only — quotation submitted
          </div>
        )}
      </div>

      {/* Submitted banner */}
      {submitted && (
        <div className={`mx-8 mt-4 flex items-center gap-3 px-5 py-4 rounded-xl border text-sm font-medium
          ${q.requiresApproval
            ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
          <CheckCircle size={18} className="shrink-0" />
          <div>
            <p className="font-semibold">{q.requiresApproval ? 'Pending Approval' : 'Auto-Approved — no approval needed'}</p>
            {q.requiresApproval && (
              <p className="text-xs opacity-70 mt-0.5">
                Routed to {q.requiredApprovalLevel === 'FINANCE' ? 'Sales Manager → Finance' : 'Sales Manager'} · Risk score {riskScore.toFixed(1)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Catalog + Lines */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Product Catalog */}
          {isEditable && (
            <div className="border-b border-zinc-800 px-8 py-5 bg-zinc-950/60">
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                <Package size={12} /> Product Catalogue — Click to add
              </p>
              {/* Category tabs + search */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                  {(['ALL', 'HARDWARE', 'SERVICES', 'SUBSCRIPTION'] as const).map(c => (
                    <button
                      key={c}
                      id={`cat-tab-${c.toLowerCase()}`}
                      onClick={() => setCatFilter(c)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${catFilter === c ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 max-w-xs">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search products…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition"
                  />
                </div>
              </div>

              {/* Product grid */}
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                {filteredProducts.map(p => {
                  const inCart = addedProductIds.has(p.id);
                  const isAdding = adding === p.id;
                  return (
                    <button
                      key={p.id}
                      id={`add-product-${p.id}`}
                      onClick={() => !inCart && addProduct(p.id)}
                      disabled={inCart || !!adding}
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-all text-sm ${
                        inCart
                          ? 'bg-zinc-800/50 border-zinc-700/50 cursor-default opacity-50'
                          : 'bg-zinc-800 border-zinc-700 hover:border-violet-500/50 hover:bg-violet-500/10 cursor-pointer'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-100 truncate text-xs">{p.name}</p>
                        <p className="text-zinc-500 text-xs">{fmt(p.unitPrice)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <CategoryBadge cat={p.category} />
                        {inCart
                          ? <CheckCircle size={13} className="text-emerald-400" />
                          : isAdding
                          ? <RefreshCw size={12} className="animate-spin text-violet-400" />
                          : <Plus size={13} className="text-zinc-500" />
                        }
                      </div>
                    </button>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <p className="col-span-3 text-xs text-zinc-500 text-center py-4">No products match your filter.</p>
                )}
              </div>
            </div>
          )}

          {/* Quote Lines */}
          <div className="flex-1 overflow-auto px-8 py-5">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShoppingCart size={12} /> Quote Lines ({q.lines.length})
            </p>

            {q.lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-zinc-800 rounded-xl">
                <ShoppingCart size={28} className="text-zinc-700 mb-3" />
                <p className="text-zinc-500 text-sm">No products added yet.</p>
                {isEditable && <p className="text-zinc-600 text-xs mt-1">Use the catalogue above to add products.</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Table header */}
                <div className="grid grid-cols-[2fr_1fr_1.2fr_1.2fr_1fr_auto] gap-3 px-4 py-2 text-xs text-zinc-500 font-medium">
                  <span>Product</span>
                  <span>Qty</span>
                  <span>Discount %</span>
                  <span>Line Total</span>
                  <span>Margin</span>
                  <span />
                </div>

                {q.lines.map(line => {
                  const isUpdating = lineUpdating === line.id;
                  const marginPctLine = parseFloat(line.marginPercent) || 0;
                  const marginColor = marginPctLine >= 30 ? 'text-emerald-400' : marginPctLine >= 15 ? 'text-amber-400' : 'text-red-400';

                  return (
                    <div
                      key={line.id}
                      className={`grid grid-cols-[2fr_1fr_1.2fr_1.2fr_1fr_auto] gap-3 items-center px-4 py-3 bg-zinc-900 border rounded-xl transition-all ${
                        line.isOverDiscountLimit ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800'
                      } ${isUpdating ? 'opacity-60' : ''}`}
                    >
                      {/* Product info */}
                      <div>
                        <p className="text-sm font-medium text-zinc-100 truncate">{line.productName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CategoryBadge cat={line.category} />
                          {line.isOverDiscountLimit && (
                            <span className="text-xs text-amber-400 flex items-center gap-0.5">
                              <AlertTriangle size={10} /> Over limit
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Qty */}
                      <div className="flex items-center gap-1">
                        {isEditable ? (
                          <>
                            <button onClick={() => updateLineQty(line.id, -1, line.quantity)} disabled={isUpdating || line.quantity <= 1}
                              className="w-6 h-6 rounded-md bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 disabled:opacity-40 transition">
                              <div className="text-lg">-</div>
                            </button>
                            <span className="w-7 text-center text-sm font-semibold text-zinc-100">{line.quantity}</span>
                            <button onClick={() => updateLineQty(line.id, 1, line.quantity)} disabled={isUpdating}
                              className="w-6 h-6 rounded-md bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 disabled:opacity-40 transition">
                              <Plus size={11} />
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-zinc-200">{line.quantity}</span>
                        )}
                      </div>

                      {/* Discount */}
                      <div>
                        {isEditable ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0} max={100} step={0.5}
                              defaultValue={parseFloat(line.discountPercent).toFixed(1)}
                              onBlur={e => updateLineDiscount(line.id, parseFloat(e.target.value) || 0)}
                              disabled={isUpdating}
                              className="w-16 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 text-center"
                            />
                            <span className="text-xs text-zinc-500">%</span>
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-200">{parseFloat(line.discountPercent).toFixed(1)}%</span>
                        )}
                        {parseFloat(line.maxDiscountPercent) > 0 && (
                          <p className="text-xs text-zinc-600 mt-0.5">Max: {parseFloat(line.maxDiscountPercent).toFixed(0)}%</p>
                        )}
                      </div>

                      {/* Line total */}
                      <p className="text-sm font-semibold text-zinc-100">{fmt(line.lineTotal)}</p>

                      {/* Margin */}
                      <p className={`text-sm font-semibold ${marginColor}`}>{marginPctLine.toFixed(1)}%</p>

                      {/* Remove */}
                      {isEditable && (
                        <button
                          id={`remove-line-${line.id}`}
                          onClick={() => removeLine(line.id)}
                          disabled={isUpdating}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar: Totals + Upsell + Notes */}
        <div className="w-80 shrink-0 border-l border-zinc-800 overflow-auto flex flex-col">

          {/* Order Totals */}
          <div className="p-5 border-b border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-4">Order Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span>{fmt(q.subtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Discounts</span>
                <span className="text-red-400">-{fmt(q.discountAmount)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Tax</span>
                <span>{fmt(q.taxAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-white text-base pt-2 border-t border-zinc-800">
                <span>Grand Total</span>
                <span>{fmt(q.grandTotal)}</span>
              </div>
            </div>

            <div className="mt-4">
              <MarginBar pct={marginPct} />
            </div>

            {riskScore >= 10 && (
              <div className={`mt-3 flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg border ${
                riskScore >= 50 ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}>
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>Risk score {riskScore.toFixed(1)} — will require{riskScore >= 50 ? ' Finance + ' : ' '}Manager approval</span>
              </div>
            )}

            {/* Order discount */}
            {isEditable && (
              <div className="mt-4">
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Order-level Discount %</label>
                <input
                  type="number" min={0} max={100} step={0.5}
                  value={orderDiscount}
                  onChange={e => setOrderDiscount(e.target.value)}
                  onBlur={handleDiscountBlur}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 transition"
                />
              </div>
            )}
          </div>

          {/* Upsell suggestions */}
          {isEditable && upsellSuggestions.length > 0 && (
            <div className="p-5 border-b border-zinc-800">
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Star size={11} className="text-amber-400" /> Suggested Add-ons
              </p>
              <div className="space-y-2">
                {upsellSuggestions.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <CategoryBadge cat={p.category} />
                        <span className="text-xs text-zinc-500">{fmt(p.unitPrice)}</span>
                      </div>
                    </div>
                    <button
                      id={`upsell-add-${p.id}`}
                      onClick={() => addProduct(p.id)}
                      disabled={!!adding}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition disabled:opacity-50 shrink-0"
                    >
                      <Plus size={11} /> Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="p-5">
            <label className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText size={11} /> Internal Notes
            </label>
            <textarea
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              disabled={!isEditable}
              rows={5}
              placeholder="Deal context, special instructions…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none transition disabled:opacity-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
