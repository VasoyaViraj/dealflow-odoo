import { ChevronRight, RefreshCw, Clock, Globe } from 'lucide-react';
import type { Quotation } from '../../types/quotation';
import { StatusBadge } from '../ui/badges';

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor(diff / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h >= 1) return `${h}h ago`;
  if (m >= 1) return `${m}m ago`;
  return 'just now';
}

export function PortalQuotationList({
  quotations,
  loading,
  onOpen,
  onRefresh,
}: {
  quotations: Quotation[];
  loading: boolean;
  onOpen: (q: Quotation) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">My Quotations</h1>
          <p className="text-subtle text-sm mt-1">View, review, and confirm your quotations.</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-soft border border-hairline text-body hover:text-ink rounded-lg text-sm transition"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Banner */}
      <div className="bg-link/10 border border-link/30 rounded-md px-5 py-4 flex items-start gap-3 mb-6">
        <Globe size={18} className="text-link mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-link">Customer Portal</p>
          <p className="text-xs text-link mt-0.5">
            Review your quotations, request changes, and confirm your order — all in one place.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32 text-subtle">
          <RefreshCw size={20} className="animate-spin mr-3" /> Loading quotations…
        </div>
      ) : quotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-lg bg-link/10 border border-link/30 flex items-center justify-center mb-4">
            <Globe size={28} className="text-link" />
          </div>
          <h2 className="text-lg font-semibold text-ink">No quotations yet</h2>
          <p className="text-subtle text-sm mt-2 max-w-sm">Your account has no submitted quotations. Please contact your sales representative.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {quotations.map(q => (
            <div
              key={q.id}
              id={`portal-quotation-${q.id}`}
              onClick={() => onOpen(q)}
              className="bg-canvas border border-hairline hover:border-line-strong hover:bg-soft rounded-lg p-5 flex flex-col gap-3 cursor-pointer transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-subtle font-mono">{q.quotationNumber}</p>
                  <p className="font-semibold text-ink text-base mt-0.5">{q.customer?.name}</p>
                </div>
                <ChevronRight size={18} className="text-line-strong group-hover:text-body transition" />
              </div>

              <div className="flex">
                <StatusBadge status={q.status} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-soft rounded-md px-3 py-2.5">
                  <p className="text-xs text-subtle mb-0.5">Total</p>
                  <p className="text-sm font-bold text-ink">{fmt(q.grandTotal)}</p>
                </div>
                <div className="bg-soft rounded-md px-3 py-2.5">
                  <p className="text-xs text-subtle mb-0.5">Date</p>
                  <p className="text-sm font-semibold text-ink">{fmtDate(q.createdAt)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-hairline text-xs text-subtle">
                <span className="flex items-center gap-1"><Clock size={11} /> {timeAgo(q.updatedAt)}</span>
                <span className="text-link font-medium group-hover:text-link-active transition">View details →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
