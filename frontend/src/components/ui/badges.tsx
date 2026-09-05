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
  RISK_CALCULATED: 'Risk Scored',
  REVISION_REQUESTED: 'Revision Requested',
  NEGOTIATION_REQUESTED: 'In Negotiation',
  CONFIRMED: 'Confirmed',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
};

/* Status pills read as quiet editorial chips: a soft brand surface, ink type,
   and a hairline. Only the two decided states (approved / rejected) borrow a
   semantic hue, so a queue of drafts stays calm. */
export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-soft text-subtle border-hairline',
  SUBMITTED: 'bg-link/8 text-link border-link/25',
  PENDING_MANAGER: 'bg-cream text-ink border-mustard/40',
  PENDING_FINANCE: 'bg-mustard/20 text-warning border-mustard/50',
  APPROVED: 'bg-success/10 text-success border-success/30',
  REJECTED: 'bg-coral/8 text-coral border-coral/30',
  CANCELLED: 'bg-soft text-subtle border-hairline',
  EXPIRED: 'bg-soft text-subtle border-hairline',
  RISK_CALCULATED: 'bg-link/8 text-link border-link/25',
  REVISION_REQUESTED: 'bg-peach/35 text-coral border-coral/25',
  NEGOTIATION_REQUESTED: 'bg-peach/35 text-coral border-coral/25',
  CONFIRMED: 'bg-forest text-white border-forest',
  SENT: 'bg-link/8 text-link border-link/25',
  ACCEPTED: 'bg-success/10 text-success border-success/30',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold tracking-wide px-2.5 py-0.5 rounded-full border ${
        STATUS_COLORS[status] ?? 'bg-soft text-subtle border-hairline'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function CategoryBadge({ cat }: { cat: string }) {
  const colors: Record<string, string> = {
    HARDWARE: 'bg-link/8 text-link border-link/25',
    SERVICES: 'bg-mint/40 text-forest border-forest/20',
    SUBSCRIPTION: 'bg-cream text-ink border-mustard/40',
  };
  return (
    <span
      className={`inline-flex items-center text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded-full border ${
        colors[cat] ?? 'bg-soft text-subtle border-hairline'
      }`}
    >
      {cat}
    </span>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    GOLD: 'bg-mustard/25 text-warning',
    SILVER: 'bg-strong text-subtle',
    BRONZE: 'bg-peach/35 text-coral',
  };
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-[0.09em] px-1.5 py-0.5 rounded-sm ${
        colors[tier] ?? 'bg-soft text-subtle'
      }`}
    >
      {tier}
    </span>
  );
}

export function RiskBadge({ score }: { score: string }) {
  const n = parseFloat(score);
  const base =
    'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border';
  if (n >= 50)
    return (
      <span className={`${base} bg-coral/8 text-coral border-coral/30`}>
        <AlertTriangle size={10} />
        High Risk
      </span>
    );
  if (n >= 10)
    return (
      <span className={`${base} bg-mustard/20 text-warning border-mustard/50`}>
        <AlertTriangle size={10} />
        Med Risk
      </span>
    );
  return null;
}
