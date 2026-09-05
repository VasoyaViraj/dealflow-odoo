import { TrendingUp, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import type { QueueItem } from '../../pages/ManagerDashboard';

interface Props {
  items: QueueItem[];
  onReview: (id: string) => void;
  accentColor?: 'emerald' | 'amber';
}

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function RiskBadge({ score }: { score: string }) {
  const n = parseFloat(score);
  if (n >= 50) return <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 rounded-full"><AlertTriangle size={11} />HIGH</span>;
  if (n >= 10) return <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full"><AlertTriangle size={11} />MEDIUM</span>;
  return <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full"><TrendingUp size={11} />LOW</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING_MANAGER: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    PENDING_FINANCE: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  };
  const label: Record<string, string> = {
    PENDING_MANAGER: 'Awaiting Manager',
    PENDING_FINANCE: 'Awaiting Finance',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${map[status] ?? 'bg-zinc-700 text-zinc-300'}`}>
      {label[status] ?? status}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor(diff / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h >= 1) return `${h}h ago`;
  if (m >= 1) return `${m}m ago`;
  return 'just now';
}

export default function ApprovalQueue({ items, onReview, accentColor = 'emerald' }: Props) {
  const accent = accentColor === 'amber'
    ? 'hover:border-amber-500/40 hover:bg-amber-500/5'
    : 'hover:border-violet-500/40 hover:bg-violet-500/5';

  const btnClass = accentColor === 'amber'
    ? 'bg-amber-600 hover:bg-amber-500 text-white'
    : 'bg-violet-600 hover:bg-violet-500 text-white';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((item) => (
        <div
          key={item.id}
          className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 cursor-pointer group ${accent}`}
          onClick={() => onReview(item.id)}
        >
          {/* Top row */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-white text-base">{item.customerName ?? 'Unknown Customer'}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <StatusBadge status={item.status} />
                <RiskBadge score={item.riskScore} />
              </div>
            </div>
            <ChevronRight size={18} className="text-zinc-600 group-hover:text-zinc-300 transition mt-1" />
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-800/60 rounded-xl px-4 py-3">
              <p className="text-xs text-zinc-500 mb-1">Grand Total</p>
              <p className="text-base font-bold text-white">{fmt(item.grandTotal)}</p>
            </div>
            <div className="bg-zinc-800/60 rounded-xl px-4 py-3">
              <p className="text-xs text-zinc-500 mb-1">Risk Score</p>
              <p className={`text-base font-bold ${parseFloat(item.riskScore) >= 50 ? 'text-red-400' : parseFloat(item.riskScore) >= 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {parseFloat(item.riskScore).toFixed(1)}
              </p>
            </div>
          </div>

          {/* Approval chain indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${item.status === 'PENDING_MANAGER' ? 'bg-violet-500' : 'bg-zinc-600'}`} />
            <div className={`flex-1 h-px ${item.approvalLevel === 'FINANCE' ? 'bg-zinc-700' : 'bg-zinc-800'}`} />
            <div className={`w-2.5 h-2.5 rounded-full ${item.status === 'PENDING_FINANCE' ? 'bg-amber-500' : item.approvalLevel === 'FINANCE' ? 'bg-zinc-600' : 'bg-zinc-800'}`} />
            <span className="text-xs text-zinc-600 ml-1">
              {item.approvalLevel === 'FINANCE' ? 'Mgr → Finance' : 'Manager only'}
            </span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Clock size={12} />
              {timeAgo(item.updatedAt)}
            </span>
            <button
              id={`review-btn-${item.id}`}
              onClick={(e) => { e.stopPropagation(); onReview(item.id); }}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all ${btnClass}`}
            >
              Review
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
