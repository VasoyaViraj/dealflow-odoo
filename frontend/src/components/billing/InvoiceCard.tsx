import { useState } from 'react';
import {
  FileText, CheckCircle, Clock, XCircle, AlertTriangle,
  CreditCard, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { Invoice, InvoiceLineSnapshot } from '../../types/billing';

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

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Invoice['status'], {
  label: string;
  icon: React.ElementType;
  cls: string;
  dot: string;
}> = {
  DRAFT:     { label: 'Draft',     icon: Clock,          cls: 'text-zinc-400  bg-zinc-800   border-zinc-700',  dot: 'bg-zinc-500'   },
  ISSUED:    { label: 'Issued',    icon: FileText,       cls: 'text-sky-300   bg-sky-500/10  border-sky-500/30', dot: 'bg-sky-400'    },
  PAID:      { label: 'Paid',      icon: CheckCircle,    cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' },
  CANCELLED: { label: 'Cancelled', icon: XCircle,        cls: 'text-red-300   bg-red-500/10   border-red-500/30',   dot: 'bg-red-400'    },
  OVERDUE:   { label: 'Overdue',   icon: AlertTriangle,  cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30', dot: 'bg-amber-400'  },
};

function StatusPill({ status }: { status: Invoice['status'] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ─── Line rows ────────────────────────────────────────────────────────────────

function LineRows({ lines }: { lines: InvoiceLineSnapshot[] }) {
  return (
    <div className="mt-4 border border-zinc-800 rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-500">
            <th className="px-4 py-2.5 text-left font-medium">Product</th>
            <th className="px-4 py-2.5 text-center font-medium">Qty</th>
            <th className="px-4 py-2.5 text-right font-medium">Unit</th>
            <th className="px-4 py-2.5 text-right font-medium">Disc</th>
            <th className="px-4 py-2.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
              <td className="px-4 py-2.5">
                <p className="font-medium text-zinc-200">{l.productName}</p>
                {l.productSku && <p className="text-zinc-600 font-mono">{l.productSku}</p>}
              </td>
              <td className="px-4 py-2.5 text-center text-zinc-400">{l.quantity}</td>
              <td className="px-4 py-2.5 text-right text-zinc-400">{fmt(l.unitPrice)}</td>
              <td className="px-4 py-2.5 text-right">
                {parseFloat(l.discountPercent) > 0
                  ? <span className="text-emerald-400">{parseFloat(l.discountPercent).toFixed(1)}%</span>
                  : <span className="text-zinc-600">—</span>}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-zinc-100">{fmt(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── InvoiceCard ──────────────────────────────────────────────────────────────

interface InvoiceCardProps {
  invoice: Invoice;
  canPay?: boolean;
  onPay?: () => void;
  paying?: boolean;
}

export function InvoiceCard({ invoice, canPay, onPay, paying }: InvoiceCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Header stripe */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <FileText size={16} className="text-sky-400" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-mono">{invoice.invoiceNumber}</p>
            <p className="text-sm font-semibold text-white">One-time Invoice</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={invoice.status} />
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1"
            aria-label="Toggle invoice details"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Amounts row */}
      <div className="grid grid-cols-3 gap-0 divide-x divide-zinc-800">
        {[
          { label: 'Subtotal', value: fmt(invoice.subtotal) },
          { label: 'Tax (GST)', value: fmt(invoice.taxAmount) },
          { label: 'Grand Total', value: fmt(invoice.grandTotal), highlight: true },
        ].map(s => (
          <div key={s.label} className="px-5 py-4">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className={`text-base font-bold mt-0.5 ${s.highlight ? 'text-white' : 'text-zinc-300'}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Due date + pay button */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>Due: <span className="text-zinc-300 font-medium">{fmtDate(invoice.dueDate)}</span></span>
          {invoice.paidAt && (
            <span className="text-emerald-400">Paid: {fmtDate(invoice.paidAt)}</span>
          )}
          {parseFloat(invoice.discountAmount) > 0 && (
            <span className="text-emerald-400">Discount: −{fmt(invoice.discountAmount)}</span>
          )}
        </div>

        {canPay && invoice.status === 'ISSUED' && (
          <button
            id="record-payment-btn"
            onClick={onPay}
            disabled={paying}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          >
            <CreditCard size={13} />
            {paying ? 'Recording…' : 'Record Payment'}
          </button>
        )}
      </div>

      {/* Expandable line detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-zinc-800">
          <p className="text-xs font-medium text-zinc-500 mt-4 mb-2">Invoice Lines</p>
          <LineRows lines={invoice.lineSnapshot} />
        </div>
      )}
    </div>
  );
}
