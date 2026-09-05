import { useState } from 'react';
import {
  RefreshCw, XCircle, ChevronDown, ChevronUp, Calendar,
  TrendingUp, AlertTriangle, CheckCircle, Pause,
} from 'lucide-react';
import type { Subscription } from '../../types/billing';

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function daysUntil(d: string) {
  const diff = new Date(d).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Subscription['status'], {
  label: string;
  icon: React.ElementType;
  cls: string;
}> = {
  ACTIVE:    { label: 'Active',    icon: CheckCircle,  cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  PAUSED:    { label: 'Paused',    icon: Pause,        cls: 'text-amber-300   bg-amber-500/10   border-amber-500/30'   },
  CANCELLED: { label: 'Cancelled', icon: XCircle,      cls: 'text-red-300     bg-red-500/10     border-red-500/30'    },
  EXPIRED:   { label: 'Expired',   icon: AlertTriangle,cls: 'text-zinc-400    bg-zinc-800       border-zinc-700'      },
};

function StatusPill({ status }: { status: Subscription['status'] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

// ─── SubscriptionCard ─────────────────────────────────────────────────────────

interface SubscriptionCardProps {
  subscription: Subscription;
  canModify?: boolean;
  onModify?: () => void;
  onCancel?: () => void;
  onGenerateInvoice?: () => void;
}

export function SubscriptionCard({ subscription: sub, canModify, onModify, onCancel, onGenerateInvoice }: SubscriptionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const days = daysUntil(sub.nextBillingDate);
  const cycleGrossAmount = Number(sub.cycleAmount) * (1 + Number(sub.taxRate) / 100);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <RefreshCw size={15} className="text-violet-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-mono">{sub.subscriptionNumber}</p>
            <p className="text-sm font-semibold text-white">{sub.productName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={sub.status} />
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1"
            aria-label="Toggle subscription details"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-4 gap-0 divide-x divide-zinc-800">
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500">Qty</p>
          <p className="text-base font-bold text-white mt-0.5">{sub.quantity}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500">Cycle</p>
          <p className="text-base font-bold text-violet-300 mt-0.5">{CYCLE_LABELS[sub.billingCycle]}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500">Per Cycle (incl. GST)</p>
          <p className="text-base font-bold text-white mt-0.5">{fmt(cycleGrossAmount)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-500">Next Billing</p>
          <p className={`text-base font-bold mt-0.5 ${days <= 7 ? 'text-amber-300' : 'text-zinc-200'}`}>
            {fmtDate(sub.nextBillingDate)}
          </p>
          {days <= 30 && (
            <p className="text-xs text-zinc-500 mt-0.5">in {days} day{days !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* Period bar */}
      {sub.status === 'ACTIVE' && (() => {
        const start = new Date(sub.currentPeriodStart).getTime();
        const end   = new Date(sub.currentPeriodEnd).getTime();
        const now   = Date.now();
        const pct   = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
        return (
          <div className="px-5 pb-4">
            <div className="flex justify-between text-xs text-zinc-600 mb-1.5">
              <span>Period start: {fmtDate(sub.currentPeriodStart)}</span>
              <span>End: {fmtDate(sub.currentPeriodEnd)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-zinc-600 mt-1">{pct.toFixed(0)}% through current period</p>
          </div>
        );
      })()}

      {/* Cancellation info */}
      {sub.status === 'CANCELLED' && sub.cancelReason && (
        <div className="px-5 pb-4">
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-300">
            <span className="font-semibold">Cancelled:</span> {sub.cancelReason}
            {sub.cancelledAt && <span className="text-red-400/60 ml-2">on {fmtDate(sub.cancelledAt)}</span>}
          </div>
          {sub.lastProratedAmount && parseFloat(sub.lastProratedAmount) < 0 && (
            <p className="text-xs text-emerald-400 mt-2">
              Credit note: {fmt(Math.abs(parseFloat(sub.lastProratedAmount)))}
            </p>
          )}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-zinc-800 px-5 py-4">
          <div className="grid grid-cols-2 gap-4 text-xs mb-4">
            <div>
              <p className="text-zinc-500 mb-1">Unit Price</p>
              <p className="text-zinc-200 font-medium">{fmt(sub.unitPrice)} / unit</p>
            </div>
            <div>
              <p className="text-zinc-500 mb-1">Discount</p>
              <p className="text-zinc-200 font-medium">
                {parseFloat(sub.discountPercent) > 0
                  ? `${parseFloat(sub.discountPercent).toFixed(1)}%`
                  : 'None'}
              </p>
            </div>
            <div>
              <p className="text-zinc-500 mb-1">Tax Rate</p>
              <p className="text-zinc-200 font-medium">{sub.taxRate}% GST</p>
            </div>
            {sub.lastProratedAmount && (
              <div>
                <p className="text-zinc-500 mb-1">Last Proration</p>
                <p className={`font-medium ${parseFloat(sub.lastProratedAmount) < 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {parseFloat(sub.lastProratedAmount) < 0 ? '−' : '+'}{fmt(Math.abs(parseFloat(sub.lastProratedAmount)))}
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {canModify && sub.status === 'ACTIVE' && (
            <div className="flex gap-3 mt-2 flex-wrap">
              <button
                id={`modify-sub-btn-${sub.id}`}
                onClick={onModify}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition"
              >
                <TrendingUp size={12} />
                Modify (Prorate)
              </button>
              {onGenerateInvoice && (
                <button
                  id={`invoice-sub-btn-${sub.id}`}
                  onClick={onGenerateInvoice}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition"
                >
                  <Calendar size={12} />
                  Generate Invoice
                </button>
              )}
              <button
                id={`cancel-sub-btn-${sub.id}`}
                onClick={onCancel}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-red-500/20 border border-zinc-700 hover:border-red-500/40 text-zinc-300 hover:text-red-300 text-xs font-semibold rounded-lg transition"
              >
                <XCircle size={12} />
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
