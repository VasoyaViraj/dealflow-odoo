import { useState } from 'react';
import {
  FileText, CheckCircle, Clock, XCircle, AlertTriangle,
  CreditCard, ChevronDown, ChevronUp, Download
} from 'lucide-react';
import api from '../../lib/api';
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
  DRAFT:     { label: 'Draft',     icon: Clock,          cls: 'text-subtle bg-soft border-hairline',  dot: 'bg-line-strong'   },
  ISSUED:    { label: 'Issued',    icon: FileText,       cls: 'text-link bg-link/10 border-link/30', dot: 'bg-link'    },
  PAID:      { label: 'Paid',      icon: CheckCircle,    cls: 'text-success bg-success/10 border-success/30', dot: 'bg-success' },
  CANCELLED: { label: 'Cancelled', icon: XCircle,        cls: 'text-coral bg-coral/8 border-coral/30',   dot: 'bg-coral'    },
  OVERDUE:   { label: 'Overdue',   icon: AlertTriangle,  cls: 'text-warning bg-mustard/20 border-mustard/60', dot: 'bg-mustard'  },
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
    <div className="mt-4 border border-hairline rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-hairline bg-canvas text-subtle">
            <th className="px-4 py-2.5 text-left font-medium">Product</th>
            <th className="px-4 py-2.5 text-center font-medium">Qty</th>
            <th className="px-4 py-2.5 text-right font-medium">Unit</th>
            <th className="px-4 py-2.5 text-right font-medium">Disc</th>
            <th className="px-4 py-2.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-hairline hover:bg-soft transition-colors">
              <td className="px-4 py-2.5">
                <p className="font-medium text-ink">{l.productName}</p>
                {l.productSku && <p className="text-line-strong font-mono">{l.productSku}</p>}
              </td>
              <td className="px-4 py-2.5 text-center text-subtle">{l.quantity}</td>
              <td className="px-4 py-2.5 text-right text-subtle">{fmt(l.unitPrice)}</td>
              <td className="px-4 py-2.5 text-right">
                {parseFloat(l.discountPercent) > 0
                  ? <span className="text-success">{parseFloat(l.discountPercent).toFixed(1)}%</span>
                  : <span className="text-line-strong">—</span>}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-ink">{fmt(l.lineTotal)}</td>
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
  const [downloading, setDownloading] = useState(false);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice-${invoice.invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch {
      // handled by parent toast optionally, but here we can just log or add toast prop
      console.error('Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-canvas border border-hairline rounded-lg overflow-hidden">
      {/* Header stripe */}
      <div 
        className="flex items-center justify-between px-5 py-4 border-b border-hairline cursor-pointer hover:bg-soft transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-link/10 border border-link/30 flex items-center justify-center">
            <FileText size={16} className="text-link" />
          </div>
          <div>
            <p className="text-xs text-subtle font-mono">{invoice.invoiceNumber}</p>
            <p className="text-sm font-semibold text-ink">One-time Invoice</p>
          </div>
        </div>
        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
          <button
            onClick={downloadPdf}
            disabled={downloading}
            className="flex items-center gap-2 px-3 py-1.5 bg-canvas border border-hairline hover:border-line-strong text-ink rounded text-xs transition font-medium disabled:opacity-50"
          >
            <Download size={12} /> {downloading ? 'Downloading...' : 'PDF'}
          </button>
          <StatusPill status={invoice.status} />
          <div className="text-subtle p-1">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Amounts row */}
      <div className="grid grid-cols-3 gap-0 divide-x divide-hairline">
        {[
          { label: 'Subtotal', value: fmt(invoice.subtotal) },
          { label: 'Tax (GST)', value: fmt(invoice.taxAmount) },
          { label: 'Grand Total', value: fmt(invoice.grandTotal), highlight: true },
        ].map(s => (
          <div key={s.label} className="px-5 py-4">
            <p className="text-xs text-subtle">{s.label}</p>
            <p className={`text-base font-bold mt-0.5 ${s.highlight ? 'text-ink' : 'text-body'}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Due date + pay button */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-hairline bg-canvas">
        <div className="flex items-center gap-4 text-xs text-subtle">
          <span>Due: <span className="text-body font-medium">{fmtDate(invoice.dueDate)}</span></span>
          {invoice.paidAt && (
            <span className="text-success">Paid: {fmtDate(invoice.paidAt)}</span>
          )}
          {parseFloat(invoice.discountAmount) > 0 && (
            <span className="text-success">Discount: −{fmt(invoice.discountAmount)}</span>
          )}
        </div>

        {canPay && invoice.status === 'ISSUED' && (
          <button
            id="record-payment-btn"
            onClick={onPay}
            disabled={paying}
            className="flex items-center gap-2 px-4 py-2 bg-success /90 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <CreditCard size={13} />
            {paying ? 'Recording…' : 'Record Payment'}
          </button>
        )}
      </div>

      {/* Expandable line detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-hairline">
          <p className="text-xs font-medium text-subtle mt-4 mb-2">Invoice Lines</p>
          <LineRows lines={invoice.lineSnapshot} />
        </div>
      )}
    </div>
  );
}
