/**
 * FulfillmentPanel — the Warehouse Split screen (problem statement §B6).
 *
 * Two states, one component:
 *
 *   • Nothing accepted yet → the engine's recommendation, the reasons it won,
 *     its factor breakdown, and the runner-up plans it beat. Accept, or
 *     override by hand.
 *   • A split already accepted → the shipments it produced, what it cost, what
 *     is still on backorder, and — only once stock has actually arrived — the
 *     "Consolidate Remaining Backorder" action.
 *
 * The alternatives are shown deliberately. A recommendation a reviewer cannot
 * interrogate is just an assertion; showing the plan that scored 82.5 next to
 * the one that scored 83.09 is what makes the decision auditable.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, Clock, Layers,
  PackageCheck, RefreshCw, Sparkles, Truck, Warehouse,
} from 'lucide-react';
import api from '../../lib/api';
import type {
  FulfillmentOrder,
  FulfillmentSuggestion,
  ScoredPlan,
} from '../../types/fulfillment';
import { FACTOR_LABELS, STRATEGY_LABELS } from '../../types/fulfillment';
import ManualSplitEditor from './ManualSplitEditor';

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

function apiError(e: unknown, fallback: string) {
  const err = e as { response?: { data?: { error?: { message?: string } | string } } };
  const payload = err?.response?.data?.error;
  if (typeof payload === 'string') return payload;
  return payload?.message ?? fallback;
}

// ─── Small presentational pieces ─────────────────────────────────────────────

function ScoreDial({ score }: { score: number }) {
  const tone = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
  const ring = score >= 80 ? 'stroke-emerald-400' : score >= 60 ? 'stroke-amber-400' : 'stroke-red-400';
  const circumference = 2 * Math.PI * 26;

  return (
    <div className="relative w-[68px] h-[68px] shrink-0">
      <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
        <circle cx="30" cy="30" r="26" className="stroke-zinc-800" strokeWidth="6" fill="none" />
        <circle
          cx="30" cy="30" r="26" className={ring} strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(100, Math.max(0, score)) / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-sm font-bold leading-none ${tone}`}>{score.toFixed(1)}</span>
        <span className="text-[9px] text-zinc-500 uppercase tracking-wide mt-0.5">score</span>
      </div>
    </div>
  );
}

function FactorBars({ plan }: { plan: ScoredPlan }) {
  return (
    <div className="space-y-1.5">
      {FACTOR_LABELS.map(({ key, label }) => {
        const value = plan.subScores?.[key] ?? 0;
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 w-40 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
              />
            </div>
            <span className="text-[11px] text-zinc-400 w-9 text-right tabular-nums">{Math.round(value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ShipmentTable({
  shipments,
}: {
  shipments: Array<{
    warehouseId: string;
    warehouseName: string;
    totalUnits: number;
    shippingCost: string;
    deliveryDays: number;
    lines?: Array<{ productName: string; quantity: number }>;
  }>;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 px-4 py-2 bg-zinc-900/80 text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
        <span>Warehouse</span>
        <span className="text-right">Units</span>
        <span className="text-right">Shipping</span>
        <span className="text-right">Delivery</span>
      </div>
      {shipments.map((s) => (
        <div key={s.warehouseId} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 px-4 py-3 border-t border-zinc-800 text-sm">
          <span className="flex items-center gap-2 min-w-0">
            <Warehouse size={13} className="text-violet-400 shrink-0" />
            <span className="min-w-0">
              <span className="block text-zinc-100 truncate">{s.warehouseName}</span>
              {s.lines && s.lines.length > 0 && (
                <span className="block text-[11px] text-zinc-500 truncate">
                  {s.lines.map((l) => `${l.quantity} × ${l.productName}`).join(' · ')}
                </span>
              )}
            </span>
          </span>
          <span className="text-right text-zinc-300 tabular-nums">{s.totalUnits}</span>
          <span className="text-right text-zinc-300 tabular-nums">{fmt(s.shippingCost)}</span>
          <span className="text-right text-zinc-400 tabular-nums">{days(s.deliveryDays)}</span>
        </div>
      ))}
    </div>
  );
}

function ReasonList({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {reasons.map((r) => (
        <li key={r} className="flex items-start gap-2 text-xs text-zinc-300">
          <Check size={12} className="text-emerald-400 mt-0.5 shrink-0" />
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanSummaryRow({ plan }: { plan: ScoredPlan }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
      <span className="flex items-center gap-1.5"><Truck size={12} /> {plan.shipments.length} shipment{plan.shipments.length === 1 ? '' : 's'}</span>
      <span className="flex items-center gap-1.5"><Layers size={12} /> {fmt(plan.totalShippingCost)} shipping</span>
      <span className="flex items-center gap-1.5"><Clock size={12} /> {days(plan.maxDeliveryDays)}</span>
      {plan.backorderedUnits > 0 && (
        <span className="flex items-center gap-1.5 text-amber-400">
          <AlertTriangle size={12} /> {plan.backorderedUnits} on backorder
        </span>
      )}
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

interface Props {
  quotationId: string;
  /** False for a Sales Manager, who reviews the split but does not accept it. */
  canConfirm: boolean;
  onChanged?: () => void;
}

export default function FulfillmentPanel({ quotationId, canConfirm, onChanged }: Props) {
  const [data, setData] = useState<FulfillmentSuggestion | null>(null);
  const [order, setOrder] = useState<FulfillmentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [overriding, setOverriding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get(`/quotations/${quotationId}/fulfillment/plan`);
      setData(r.data.data);
      setOrder(r.data.data.existing ?? null);
    } catch (e) {
      setError(apiError(e, 'Could not load the fulfillment plan'));
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => { load(); }, [load]);

  const confirm = async (allocations?: Array<{ quotationLineId: string; warehouseId: string; quantity: number }>) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post(`/quotations/${quotationId}/fulfillment`, allocations ? { allocations } : {});
      setOrder(r.data.data);
      setOverriding(false);
      onChanged?.();
    } catch (e) {
      setError(apiError(e, 'Could not confirm the split'));
    } finally {
      setBusy(false);
    }
  };

  const consolidate = async () => {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.post(`/fulfillment/${order.id}/consolidate`);
      setOrder(r.data.data);
      onChanged?.();
    } catch (e) {
      setError(apiError(e, 'Could not consolidate the backorder'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500 py-8 justify-center">
        <RefreshCw size={14} className="animate-spin" /> Planning fulfillment…
      </div>
    );
  }

  const header = (
    <div className="flex items-center justify-between mb-4">
      <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-2">
        <Truck size={12} /> Fulfillment &amp; Warehouse Split
      </p>
      <button
        onClick={load}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition"
      >
        <RefreshCw size={11} /> Refresh
      </button>
    </div>
  );

  const errorBanner = error && (
    <div className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg border bg-red-500/10 border-red-500/30 text-red-300 mb-4">
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      <span>{error}</span>
    </div>
  );

  // ─ Confirmed: show what was accepted and what is still outstanding ─
  if (order) {
    return (
      <div>
        {header}
        {errorBanner}

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                order.status === 'FULFILLED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
              }`}>
                <PackageCheck size={17} />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {order.status === 'FULFILLED' ? 'Split confirmed — fully sourced' : 'Split confirmed — partly on backorder'}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {STRATEGY_LABELS[order.strategy] ?? order.strategy}
                  {order.isManualOverride && ' · overridden by hand'}
                  {' · '}{order.fulfilledUnits} unit{order.fulfilledUnits === 1 ? '' : 's'} sourced
                </p>
              </div>
            </div>
            <ScoreDial score={Number(order.planScore)} />
          </div>

          <div className="mb-4">
            <ShipmentTable shipments={order.shipments} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 mb-4">
            <span className="flex items-center gap-1.5"><Truck size={12} /> {order.shipmentCount} shipment{order.shipmentCount === 1 ? '' : 's'}</span>
            <span className="flex items-center gap-1.5"><Layers size={12} /> {fmt(order.totalShippingCost)} shipping</span>
            <span className="flex items-center gap-1.5"><Clock size={12} /> {days(order.maxDeliveryDays)}</span>
          </div>

          {order.reasons.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 mb-4">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wide font-semibold mb-2">Why this split</p>
              <ReasonList reasons={order.reasons} />
            </div>
          )}

          {order.backorders.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                    <AlertTriangle size={14} /> {order.backorderedUnits} unit{order.backorderedUnits === 1 ? '' : 's'} on backorder
                  </p>
                  <p className="text-xs text-amber-400/80 mt-1">
                    {order.backorders.map((b) => `${b.quantity} × ${b.productName}`).join(', ')}
                  </p>
                  <p className="text-xs text-zinc-500 mt-2">
                    {order.canConsolidate
                      ? 'Stock has arrived. Consolidating re-plans the outstanding units against current inventory.'
                      : 'No stock is available for these items yet — the action unlocks as soon as some arrives.'}
                  </p>
                </div>
                {canConfirm && (
                  <button
                    onClick={consolidate}
                    disabled={!order.canConsolidate || busy}
                    className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busy ? <RefreshCw size={13} className="animate-spin" /> : <PackageCheck size={13} />}
                    Consolidate Remaining Backorder
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─ Not yet confirmed ─
  const recommended = data?.recommended ?? null;

  if (!recommended) {
    return (
      <div>
        {header}
        {errorBanner}
        <p className="text-sm text-zinc-500 py-6 text-center border border-dashed border-zinc-800 rounded-xl">
          Nothing on this quotation needs a warehouse.
        </p>
      </div>
    );
  }

  const initialDraft: Record<string, number> = {};
  for (const a of recommended.allocations) {
    initialDraft[`${a.quotationLineId}:${a.warehouseId}`] = a.quantity;
  }

  return (
    <div>
      {header}
      {errorBanner}

      {overriding ? (
        <ManualSplitEditor
          demandLines={data!.demandLines}
          stock={data!.stock}
          initial={initialDraft}
          saving={busy}
          onCancel={() => setOverriding(false)}
          onSubmit={(allocations) => confirm(allocations)}
        />
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center">
                <Sparkles size={17} />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">Recommended split</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {STRATEGY_LABELS[recommended.strategy] ?? recommended.strategy}
                  {data && data.alternatives.length > 0 && ` · best of ${data.alternatives.length + 1} plans`}
                </p>
              </div>
            </div>
            <ScoreDial score={recommended.score} />
          </div>

          <div className="mb-4">
            <ShipmentTable shipments={recommended.shipments} />
          </div>

          <div className="mb-4">
            <PlanSummaryRow plan={recommended} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wide font-semibold mb-2">Why this plan</p>
              <ReasonList reasons={recommended.reasons} />
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wide font-semibold mb-3">Score breakdown</p>
              <FactorBars plan={recommended} />
            </div>
          </div>

          {data && data.nonStockedLines.length > 0 && (
            <p className="text-xs text-zinc-500 mb-4">
              {data.nonStockedLines.map((l) => l.productName).join(', ')} need no warehouse allocation.
            </p>
          )}

          {data && data.alternatives.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowAlternatives((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition"
              >
                {showAlternatives ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {data.alternatives.length} alternative plan{data.alternatives.length === 1 ? '' : 's'} considered
              </button>

              {showAlternatives && (
                <div className="mt-3 space-y-3">
                  {data.alternatives.map((alt) => (
                    <div key={alt.strategy} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-zinc-300">
                          {STRATEGY_LABELS[alt.strategy] ?? alt.strategy}
                        </p>
                        <span className="text-xs text-zinc-500 tabular-nums">
                          score {alt.score.toFixed(1)}
                          <span className="text-zinc-600"> · −{(recommended.score - alt.score).toFixed(1)}</span>
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mb-2">
                        {alt.shipments.map((s) => `${s.totalUnits} from ${s.warehouseName}`).join(' + ')}
                      </p>
                      <PlanSummaryRow plan={alt} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {canConfirm ? (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setOverriding(true)}
                disabled={busy}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 border border-zinc-700 hover:bg-zinc-800 transition disabled:opacity-40"
              >
                Manual Override
              </button>
              <button
                onClick={() => confirm()}
                disabled={busy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition disabled:opacity-40"
              >
                {busy ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                Accept Suggested Split
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 text-right">
              Finance / Operations or the owning rep confirms the split.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
