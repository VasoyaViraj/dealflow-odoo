import { Calendar, CheckCircle, Clock, SkipForward } from 'lucide-react';
import type { BillingScheduleEntry } from '../../types/billing';

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

function fmtMonth(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

const STATUS_ICON: Record<BillingScheduleEntry['status'], React.ElementType> = {
  UPCOMING: Clock,
  INVOICED: CheckCircle,
  SKIPPED:  SkipForward,
};

const STATUS_STYLE: Record<BillingScheduleEntry['status'], { node: string; label: string; line: string }> = {
  UPCOMING: { node: 'border-ink bg-cream', label: 'text-link', line: 'bg-soft' },
  INVOICED: { node: 'border-success bg-success/10', label: 'text-success', line: 'bg-success/10' },
  SKIPPED:  { node: 'border-hairline bg-soft', label: 'text-line-strong', line: 'bg-soft' },
};

interface BillingScheduleTimelineProps {
  entries: BillingScheduleEntry[];
  /** How many entries to show initially before "Show more" */
  initialCount?: number;
}

export function BillingScheduleTimeline({ entries, initialCount = 6 }: BillingScheduleTimelineProps) {
  const [showAll, setShowAll] = React.useState(false);
  const visible = showAll ? entries : entries.slice(0, initialCount);
  const hidden  = entries.length - initialCount;

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-line-strong text-sm">
        <Calendar size={16} className="mr-2" />
        No billing schedule entries
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-0">
        {visible.map((entry, idx) => {
          const Icon  = STATUS_ICON[entry.status];
          const style = STATUS_STYLE[entry.status];
          const isLast = idx === visible.length - 1;

          return (
            <div key={entry.id} className="flex gap-3 group">
              {/* Timeline spine */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all group-hover:scale-110 ${style.node}`}>
                  <Icon size={13} className={style.label} />
                </div>
                {!isLast && <div className={`w-0.5 flex-1 min-h-[20px] ${style.line} mt-1`} />}
              </div>

              {/* Content */}
              <div className={`pb-4 flex-1 flex items-start justify-between ${isLast ? 'pb-0' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-ink">{fmtDate(entry.dueDate)}</p>
                  <p className="text-xs text-subtle">{fmtMonth(entry.dueDate)}</p>
                  {entry.status === 'INVOICED' && entry.invoiceId && (
                    <p className="text-xs text-success mt-0.5">Invoice issued</p>
                  )}
                  {entry.status === 'SKIPPED' && (
                    <p className="text-xs text-line-strong mt-0.5">Skipped (subscription cancelled)</p>
                  )}
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${entry.status === 'SKIPPED' ? 'text-line-strong line-through' : 'text-ink'}`}>
                    {fmt(entry.amount)}
                  </p>
                  <p className={`text-xs capitalize mt-0.5 ${style.label}`}>{entry.status.toLowerCase()}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more / less toggle */}
      {entries.length > initialCount && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="mt-3 text-xs text-link hover:text-link-active transition flex items-center gap-1.5"
        >
          {showAll
            ? `↑ Show fewer`
            : `↓ Show ${hidden} more billing event${hidden !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

// Need React import for useState
import React from 'react';
