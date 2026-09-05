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
  ACTIVE:    { label: 'Active',    icon: CheckCircle,  cls: 'text-success bg-success/10 border-success/30' },
  PAUSED:    { label: 'Paused',    icon: Pause,        cls: 'text-warning bg-mustard/20 border-mustard/60'   },
  CANCELLED: { label: 'Cancelled', icon: XCircle,      cls: 'text-coral bg-coral/8 border-coral/30'    },
  EXPIRED:   { label: 'Expired',   icon: AlertTriangle,cls: 'text-subtle bg-soft border-hairline'      },
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
    <div className="bg-canvas border border-hairline rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-cream border border-hairline flex items-center justify-center">
            <RefreshCw size={15} className="text-link" />
          </div>
          <div>
            <p className="text-xs text-subtle font-mono">{sub.subscriptionNumber}</p>
            <p className="text-sm font-semibold text-ink">{sub.productName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={sub.status} />
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-subtle hover:text-ink transition-colors p-1"
            aria-label="Toggle subscription details"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-4 gap-0 divide-x divide-hairline">
        <div className="px-5 py-4">
          <p className="text-xs text-subtle">Qty</p>
          <p className="text-base font-bold text-ink mt-0.5">{sub.quantity}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-subtle">Cycle</p>
          <p className="text-base font-bold text-link mt-0.5">{CYCLE_LABELS[sub.billingCycle]}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-subtle">Per Cycle (incl. GST)</p>
          <p className="text-base font-bold text-ink mt-0.5">{fmt(cycleGrossAmount)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-subtle">Next Billing</p>
          <p className={`text-base font-bold mt-0.5 ${days <= 7 ? 'text-warning' : 'text-ink'}`}>
            {fmtDate(sub.nextBillingDate)}
          </p>
          {days <= 30 && (
            <p className="text-xs text-subtle mt-0.5">in {days} day{days !== 1 ? 's' : ''}</p>
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
            <div className="flex justify-between text-xs text-line-strong mb-1.5">
              <span>Period start: {fmtDate(sub.currentPeriodStart)}</span>
              <span>End: {fmtDate(sub.currentPeriodEnd)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-soft overflow-hidden">
              <div
                className="h-full rounded-full bg-ink transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-line-strong mt-1">{pct.toFixed(0)}% through current period</p>
          </div>
        );
      })()}

      {/* Cancellation info */}
      {sub.status === 'CANCELLED' && sub.cancelReason && (
        <div className="px-5 pb-4">
          <div className="bg-coral/8 border border-coral/30 rounded-md px-4 py-3 text-xs text-coral">
            <span className="font-semibold">Cancelled:</span> {sub.cancelReason}
            {sub.cancelledAt && <span className="text-coral ml-2">on {fmtDate(sub.cancelledAt)}</span>}
          </div>
          {sub.lastProratedAmount && parseFloat(sub.lastProratedAmount) < 0 && (
            <p className="text-xs text-success mt-2">
              Credit note: {fmt(Math.abs(parseFloat(sub.lastProratedAmount)))}
            </p>
          )}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-hairline px-5 py-4">
          <div className="grid grid-cols-2 gap-4 text-xs mb-4">
            <div>
              <p className="text-subtle mb-1">Unit Price</p>
              <p className="text-ink font-medium">{fmt(sub.unitPrice)} / unit</p>
            </div>
            <div>
              <p className="text-subtle mb-1">Discount</p>
              <p className="text-ink font-medium">
                {parseFloat(sub.discountPercent) > 0
                  ? `${parseFloat(sub.discountPercent).toFixed(1)}%`
                  : 'None'}
              </p>
            </div>
            <div>
              <p className="text-subtle mb-1">Tax Rate</p>
              <p className="text-ink font-medium">{sub.taxRate}% GST</p>
            </div>
            {sub.lastProratedAmount && (
              <div>
                <p className="text-subtle mb-1">Last Proration</p>
                <p className={`font-medium ${parseFloat(sub.lastProratedAmount) < 0 ? 'text-success' : 'text-warning'}`}>
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
                className="flex items-center gap-2 px-4 py-2 bg-ink hover:bg-ink-active text-white text-xs font-semibold rounded-lg transition"
              >
                <TrendingUp size={12} />
                Modify (Prorate)
              </button>
              {onGenerateInvoice && (
                <button
                  id={`invoice-sub-btn-${sub.id}`}
                  onClick={onGenerateInvoice}
                  className="flex items-center gap-2 px-4 py-2 bg-success /90 text-white text-xs font-semibold rounded-lg transition"
                >
                  <Calendar size={12} />
                  Generate Invoice
                </button>
              )}
              <button
                id={`cancel-sub-btn-${sub.id}`}
                onClick={onCancel}
                className="flex items-center gap-2 px-4 py-2 bg-soft hover:bg-coral/8 border border-hairline hover:border-coral text-body hover:text-coral text-xs font-semibold rounded-lg transition"
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
