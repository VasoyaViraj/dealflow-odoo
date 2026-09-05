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
          <h1 className="text-2xl font-bold text-white">Sales Workspace</h1>
          <p className="text-zinc-400 text-sm mt-1">Create and manage your quotations.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded-lg text-sm transition">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            id="new-quotation-btn"
            onClick={onNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-violet-500/20 transition"
          >
            <Plus size={15} /> New Quotation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Quotations', value: quotations.length, icon: <FileText size={18} />, color: 'text-zinc-300' },
          { label: 'Pending Approval', value: pending, icon: <Clock size={18} />, color: 'text-amber-400' },
          { label: 'Approved', value: approved, icon: <CheckCircle size={18} />, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className={`${s.color} opacity-60`}>{s.icon}</div>
            <div>
              <p className="text-xs text-zinc-500 font-medium">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quotation Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-32 text-zinc-500">
          <RefreshCw size={20} className="animate-spin mr-3" /> Loading quotations…
        </div>
      ) : quotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
            <ShoppingCart size={28} className="text-violet-400" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-200">No quotations yet</h2>
          <p className="text-zinc-500 text-sm mt-2 max-w-sm">Create your first quotation to start building deals.</p>
          <button onClick={onNew} className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition">
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
              className="bg-zinc-900 border border-zinc-800 hover:border-violet-500/40 hover:bg-violet-500/5 rounded-2xl p-5 flex flex-col gap-3 cursor-pointer transition-all duration-200 group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-mono">{q.quotationNumber}</p>
                  <p className="font-semibold text-white text-base mt-0.5">{q.customer?.name ?? '—'}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{q.customer && <TierBadge tier={q.customer.tier} />}</p>
                </div>
                <ChevronRight size={18} className="text-zinc-600 group-hover:text-zinc-300 transition mt-1" />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={q.status} />
                {parseFloat(q.blendedRiskScore) > 0 && <RiskBadge score={q.blendedRiskScore} />}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/60 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-zinc-500 mb-0.5">Grand Total</p>
                  <p className="text-sm font-bold text-white">{fmt(q.grandTotal)}</p>
                </div>
                <div className="bg-zinc-800/60 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-zinc-500 mb-0.5">Lines</p>
                  <p className="text-sm font-bold text-zinc-200">{q.lines?.length ?? '—'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-zinc-800 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><Clock size={11} /> {timeAgo(q.updatedAt)}</span>
                <span className="text-violet-400 font-medium group-hover:text-violet-300 transition">Open →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
