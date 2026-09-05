import { AlertTriangle } from 'lucide-react';

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_MANAGER: 'Awaiting Manager',
  PENDING_FINANCE: 'Awaiting Finance',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-zinc-700 text-zinc-300 border-zinc-600',
  SUBMITTED: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  PENDING_MANAGER: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  PENDING_FINANCE: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  APPROVED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  REJECTED: 'bg-red-500/15 text-red-300 border-red-500/30',
  CANCELLED: 'bg-zinc-700 text-zinc-400 border-zinc-600',
  EXPIRED: 'bg-zinc-700 text-zinc-400 border-zinc-600',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[status] ?? 'bg-zinc-700 text-zinc-300'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function CategoryBadge({ cat }: { cat: string }) {
  const colors: Record<string, string> = {
    HARDWARE: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    SERVICES: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    SUBSCRIPTION: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  };
  return (
    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${colors[cat] ?? 'bg-zinc-700 text-zinc-400'}`}>
      {cat}
    </span>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    GOLD: 'text-amber-400',
    SILVER: 'text-zinc-400',
    BRONZE: 'text-orange-400',
  };
  return <span className={`text-xs font-bold uppercase ${colors[tier] ?? ''}`}>{tier}</span>;
}

export function RiskBadge({ score }: { score: string }) {
  const n = parseFloat(score);
  if (n >= 50) return <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-full"><AlertTriangle size={10} />High Risk</span>;
  if (n >= 10) return <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full"><AlertTriangle size={10} />Med Risk</span>;
  return null;
}
