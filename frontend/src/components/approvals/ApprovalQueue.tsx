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
  if (n >= 50) return <span className="flex items-center gap-1 text-xs font-bold text-coral bg-coral/8 border border-coral/30 px-2.5 py-0.5 rounded-full"><AlertTriangle size={11} />HIGH</span>;
  if (n >= 10) return <span className="flex items-center gap-1 text-xs font-bold text-warning bg-mustard/20 border border-mustard/60 px-2.5 py-0.5 rounded-full"><AlertTriangle size={11} />MEDIUM</span>;
  return <span className="flex items-center gap-1 text-xs font-bold text-success bg-success/10 border border-success/30 px-2.5 py-0.5 rounded-full"><TrendingUp size={11} />LOW</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING_MANAGER: 'bg-cream text-ink border-hairline',
    PENDING_FINANCE: 'bg-mustard/20 text-warning border-mustard/60',
  };
  const label: Record<string, string> = {
    PENDING_MANAGER: 'Awaiting Manager',
    PENDING_FINANCE: 'Awaiting Finance',
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${map[status] ?? 'bg-strong text-body'}`}>
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
    ? 'hover:border-mustard hover:bg-mustard/20'
    : 'hover:border-ink hover:bg-cream';

  const btnClass = accentColor === 'amber'
    ? 'bg-mustard /90 text-ink'
    : 'bg-ink hover:bg-ink-active text-white';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((item) => (
        <div
          key={item.id}
          className={`bg-canvas border border-hairline rounded-lg p-5 flex flex-col gap-4 transition-all duration-200 cursor-pointer group ${accent}`}
          onClick={() => onReview(item.id)}
        >
          {/* Top row */}
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-ink text-base">{item.customerName ?? 'Unknown Customer'}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <StatusBadge status={item.status} />
                <RiskBadge score={item.riskScore} />
              </div>
            </div>
            <ChevronRight size={18} className="text-line-strong group-hover:text-body transition mt-1" />
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-soft rounded-md px-4 py-3">
              <p className="text-xs text-subtle mb-1">Grand Total</p>
              <p className="text-base font-bold text-ink">{fmt(item.grandTotal)}</p>
            </div>
            <div className="bg-soft rounded-md px-4 py-3">
              <p className="text-xs text-subtle mb-1">Risk Score</p>
              <p className={`text-base font-bold ${parseFloat(item.riskScore) >= 50 ? 'text-coral' : parseFloat(item.riskScore) >= 10 ? 'text-warning' : 'text-success'}`}>
                {parseFloat(item.riskScore).toFixed(1)}
              </p>
            </div>
          </div>

          {/* Approval chain indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${item.status === 'PENDING_MANAGER' ? 'bg-ink' : 'bg-strong'}`} />
            <div className={`flex-1 h-px ${item.approvalLevel === 'FINANCE' ? 'bg-strong' : 'bg-soft'}`} />
            <div className={`w-2.5 h-2.5 rounded-full ${item.status === 'PENDING_FINANCE' ? 'bg-mustard' : item.approvalLevel === 'FINANCE' ? 'bg-strong' : 'bg-soft'}`} />
            <span className="text-xs text-line-strong ml-1">
              {item.approvalLevel === 'FINANCE' ? 'Mgr → Finance' : 'Manager only'}
            </span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-hairline">
            <span className="flex items-center gap-1.5 text-xs text-subtle">
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
