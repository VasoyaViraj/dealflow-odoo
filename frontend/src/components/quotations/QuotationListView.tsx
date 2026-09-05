import { RefreshCw, Plus, FileText, Clock, CheckCircle, ShoppingCart, ChevronRight } from 'lucide-react';
import type { Quotation } from '../../types/quotation';
import { StatusBadge, TierBadge, RiskBadge } from '../ui/badges';

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
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

export function QuotationListView({
  quotations,
  loading,
  onOpen,
  onNew,
  onRefresh,
}: {
  quotations: Quotation[];
  loading: boolean;
  onOpen: (q: Quotation) => void;
  onNew: () => void;
  onRefresh: () => void;
}) {
  const pending = quotations.filter(q => ['PENDING_MANAGER', 'PENDING_FINANCE'].includes(q.status)).length;
  const approved = quotations.filter(q => q.status === 'APPROVED').length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Sales Workspace</h1>
          <p className="text-subtle text-sm mt-1">Create and manage your quotations.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 bg-soft border border-hairline text-body hover:text-ink rounded-lg text-sm transition">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            id="new-quotation-btn"
            onClick={onNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-ink text-white text-sm font-semibold rounded-lg shadow-lg transition"
          >
            <Plus size={15} /> New Quotation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Quotations', value: quotations.length, icon: <FileText size={18} />, color: 'text-body' },
          { label: 'Pending Approval', value: pending, icon: <Clock size={18} />, color: 'text-warning' },
          { label: 'Approved', value: approved, icon: <CheckCircle size={18} />, color: 'text-success' },
        ].map(s => (
          <div key={s.label} className="bg-canvas border border-hairline rounded-md px-5 py-4 flex items-center gap-4">
            <div className={`${s.color} opacity-60`}>{s.icon}</div>
            <div>
              <p className="text-xs text-subtle font-medium">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quotation Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-32 text-subtle">
          <RefreshCw size={20} className="animate-spin mr-3" /> Loading quotations…
        </div>
      ) : quotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-lg bg-cream border border-hairline flex items-center justify-center mb-4">
            <ShoppingCart size={28} className="text-link" />
          </div>
          <h2 className="text-lg font-semibold text-ink">No quotations yet</h2>
          <p className="text-subtle text-sm mt-2 max-w-sm">Create your first quotation to start building deals.</p>
          <button onClick={onNew} className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-ink hover:bg-ink-active text-white text-sm font-semibold rounded-lg transition">
            <Plus size={15} /> New Quotation
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {quotations.map(q => (
            <div
              key={q.id}
              id={`quotation-card-${q.id}`}
              onClick={() => onOpen(q)}
              className="bg-canvas border border-hairline hover:border-line-strong hover:bg-soft rounded-lg p-5 flex flex-col gap-3 cursor-pointer transition-all duration-200 group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-subtle font-mono">{q.quotationNumber}</p>
                  <p className="font-semibold text-ink text-base mt-0.5">{q.customer?.name ?? '—'}</p>
                  <p className="text-xs text-subtle mt-0.5">{q.customer && <TierBadge tier={q.customer.tier} />}</p>
                </div>
                <ChevronRight size={18} className="text-line-strong group-hover:text-body transition mt-1" />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={q.status} />
                {parseFloat(q.blendedRiskScore) > 0 && <RiskBadge score={q.blendedRiskScore} />}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-soft rounded-md px-3 py-2.5">
                  <p className="text-xs text-subtle mb-0.5">Grand Total</p>
                  <p className="text-sm font-bold text-ink">{fmt(q.grandTotal)}</p>
                </div>
                <div className="bg-soft rounded-md px-3 py-2.5">
                  <p className="text-xs text-subtle mb-0.5">Lines</p>
                  <p className="text-sm font-bold text-ink">{q.lines?.length ?? '—'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-hairline text-xs text-subtle">
                <span className="flex items-center gap-1"><Clock size={11} /> {timeAgo(q.updatedAt)}</span>
                <span className="text-link font-medium group-hover:text-link-active transition">Open →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
