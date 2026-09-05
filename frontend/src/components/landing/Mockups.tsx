import { Check, AlertTriangle, ArrowRight, Package, Repeat } from 'lucide-react';

/* Product UI fragments for the marketing surfaces.
   design.md asks demo cards to carry real product artefacts rather than
   decoration — these are drawn in markup so they stay crisp and themable
   instead of shipping screenshots. Everything here is presentational. */

const money = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** The quotation builder: lines, live margin, and an upsell nudge. */
export function QuoteBuilderFragment() {
  const lines = [
    { name: 'RX-9 Edge Gateway', qty: 24, price: 41200, cat: 'Hardware' },
    { name: 'Deployment & Rollout', qty: 1, price: 185000, cat: 'Services' },
    { name: 'Fleet Telemetry — Annual', qty: 24, price: 9600, cat: 'Subscription' },
  ];
  return (
    <div className="bg-canvas border border-hairline rounded-md overflow-hidden text-left">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-3 border-b border-hairline bg-soft">
        <span className="text-[13px] font-medium text-ink whitespace-nowrap">QT-2049</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-cream border border-mustard/40 text-ink font-semibold whitespace-nowrap">
          Awaiting Manager
        </span>
        <span className="text-[11px] text-subtle whitespace-nowrap ml-auto">Northwind Logistics · Gold</span>
      </div>

      <div className="divide-y divide-hairline">
        {lines.map((l) => (
          <div key={l.name} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-ink truncate">{l.name}</p>
              <p className="text-[11px] text-subtle">{l.cat} · qty {l.qty}</p>
            </div>
            <span className="text-[13px] text-body tabular-nums">{money(l.price)}</span>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-hairline">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Margin after 18% discount
          </span>
          <span className="text-[12px] font-semibold text-warning tabular-nums">21.4%</span>
        </div>
        <div className="h-1.5 rounded-full bg-strong overflow-hidden">
          <div className="h-full rounded-full bg-mustard" style={{ width: '42%' }} />
        </div>
      </div>

      <div className="flex items-start gap-2.5 px-4 py-3 bg-mint/30 border-t border-hairline">
        <ArrowRight size={14} className="text-forest mt-0.5 shrink-0" />
        <p className="text-[12px] text-forest leading-snug">
          Add <span className="font-semibold">4-hour SLA support</span> — recovers 3.1 pts of
          margin and matches 78% of Gold-tier deals.
        </p>
      </div>
    </div>
  );
}

/** The approval chain: who has to sign, and why routing picked them. */
export function ApprovalChainFragment() {
  const steps = [
    { role: 'Sales Rep', name: 'Submitted', state: 'done' as const },
    { role: 'Sales Manager', name: 'Discount > 15%', state: 'active' as const },
    { role: 'Finance / Ops', name: 'Risk score 62', state: 'todo' as const },
  ];
  return (
    <div className="bg-canvas border border-hairline rounded-md p-4 text-left">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={14} className="text-warning" />
        <p className="text-[13px] font-medium text-ink">Routed to two approvers</p>
      </div>
      <ol className="space-y-0">
        {steps.map((s, i) => (
          <li key={s.role} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold shrink-0 ${
                  s.state === 'done'
                    ? 'bg-success text-white'
                    : s.state === 'active'
                      ? 'bg-ink text-white'
                      : 'bg-soft text-subtle border border-hairline'
                }`}
              >
                {s.state === 'done' ? <Check size={12} /> : i + 1}
              </span>
              {i < steps.length - 1 && <span className="w-px flex-1 bg-hairline my-1" />}
            </div>
            <div className="pb-4">
              <p className="text-[13px] text-ink leading-tight">{s.role}</p>
              <p className="text-[11px] text-subtle mt-0.5">{s.name}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Multi-warehouse split with a backorder remainder. */
export function FulfillmentSplitFragment() {
  const rows = [
    { wh: 'Pune DC', qty: 14, of: 24, tone: 'bg-forest' },
    { wh: 'Bhiwandi', qty: 7, of: 24, tone: 'bg-mint' },
    { wh: 'Backorder', qty: 3, of: 24, tone: 'bg-strong' },
  ];
  return (
    <div className="bg-canvas border border-hairline rounded-md p-4 text-left">
      <div className="flex items-center gap-2 mb-3">
        <Package size={14} className="text-ink" />
        <p className="text-[13px] font-medium text-ink">RX-9 Gateway · 24 units</p>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden mb-4">
        {rows.map((r) => (
          <div key={r.wh} className={r.tone} style={{ width: `${(r.qty / r.of) * 100}%` }} />
        ))}
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.wh} className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${r.tone}`} />
            <span className="text-[12px] text-body flex-1">{r.wh}</span>
            <span className="text-[12px] text-ink tabular-nums font-medium">{r.qty}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Hybrid billing: one-time and recurring on the same order. */
export function BillingScheduleFragment() {
  const events = [
    { when: 'On confirm', what: 'Hardware + services', amt: 1173800, kind: 'once' as const },
    { when: 'Apr 1', what: 'Telemetry — 24 seats', amt: 230400, kind: 'sub' as const },
    { when: 'Apr 12', what: 'Proration — 6 seats added', amt: 41300, kind: 'sub' as const },
  ];
  return (
    <div className="bg-canvas border border-hairline rounded-md p-4 text-left">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle mb-3">
        Billing schedule · SO-2049
      </p>
      <div className="space-y-3">
        {events.map((e) => (
          <div key={e.what} className="flex items-center gap-3">
            <span
              className={`w-7 h-7 rounded-md grid place-items-center shrink-0 ${
                e.kind === 'sub' ? 'bg-cream' : 'bg-soft border border-hairline'
              }`}
            >
              {e.kind === 'sub' ? (
                <Repeat size={12} className="text-ink" />
              ) : (
                <Check size={12} className="text-ink" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-ink truncate leading-tight">{e.what}</p>
              <p className="text-[11px] text-subtle">{e.when}</p>
            </div>
            <span className="text-[12px] text-ink tabular-nums font-medium">{money(e.amt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Deal-health tiles for the dashboard fragment. */
export function DealHealthFragment() {
  const tiles = [
    { label: 'Open pipeline', value: '₹4.8 Cr', note: '38 quotations' },
    { label: 'Stalled > 7 days', value: '6', note: 'nudge queued' },
    { label: 'Discount anomalies', value: '2', note: 'above tier ceiling' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 text-left">
      {tiles.map((t) => (
        <div key={t.label} className="bg-canvas border border-hairline rounded-md p-3.5">
          <p className="text-[11px] text-subtle leading-tight">{t.label}</p>
          <p className="text-[22px] font-light text-ink mt-1.5 leading-none tabular-nums">
            {t.value}
          </p>
          <p className="text-[11px] text-subtle mt-1.5">{t.note}</p>
        </div>
      ))}
    </div>
  );
}

/** Portal negotiation thread. */
export function PortalThreadFragment() {
  return (
    <div className="bg-canvas border border-hairline rounded-md p-4 text-left space-y-3">
      <div className="flex gap-2.5">
        <span className="w-7 h-7 rounded-full bg-peach text-ink grid place-items-center text-[10px] font-semibold shrink-0">
          NL
        </span>
        <div className="bg-soft rounded-md rounded-tl-none px-3 py-2">
          <p className="text-[12px] text-body leading-snug">
            Can we hold line 3 at 24 seats and move the rest to Q3?
          </p>
        </div>
      </div>
      <div className="flex gap-2.5 flex-row-reverse">
        <span className="w-7 h-7 rounded-full bg-ink text-white grid place-items-center text-[10px] font-semibold shrink-0">
          AR
        </span>
        <div className="bg-cream rounded-md rounded-tr-none px-3 py-2">
          <p className="text-[12px] text-ink leading-snug">
            Done — revision 3 is live, pricing held to 31 Mar.
          </p>
        </div>
      </div>
      <button className="btn btn-primary btn-sm w-full" type="button" tabIndex={-1}>
        Accept revision 3
      </button>
    </div>
  );
}
