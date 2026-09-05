import { useState } from 'react';
import { ArrowLeft, CheckCircle, FileText, Send, MessageSquare } from 'lucide-react';
import type { Quotation } from '../../types/quotation';
import { StatusBadge, CategoryBadge } from '../ui/badges';

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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

export function PortalQuotationDetail({
  quotation,
  onBack,
  showToast,
}: {
  quotation: Quotation;
  onBack: () => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [counterNote, setCounterNote] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);

  const canNegotiate = ['SUBMITTED', 'PENDING_MANAGER', 'PENDING_FINANCE'].includes(quotation.status);
  const canConfirm = quotation.status === 'APPROVED';

  const handleSubmitRequest = async () => {
    if (!counterNote.trim()) {
      showToast('Please describe your request before submitting', 'error');
      return;
    }
    setSubmittingRequest(true);
    await new Promise(r => setTimeout(r, 800));
    setSubmittingRequest(false);
    setRequestSubmitted(true);
    setCounterNote('');
    showToast('Negotiation request submitted — your sales rep will follow up');
  };

  const handleConfirmOrder = async () => {
    setConfirmingOrder(true);
    await new Promise(r => setTimeout(r, 800));
    setConfirmingOrder(false);
    setOrderConfirmed(true);
    showToast('Order confirmed — your sales rep has been notified');
  };

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="w-px h-5 bg-zinc-800" />
        <div className="flex-1">
          <p className="text-xs text-zinc-500 font-mono">{quotation.quotationNumber}</p>
          <h1 className="text-xl font-bold text-white">{quotation.customer?.name}</h1>
        </div>
        <StatusBadge status={quotation.status} />
      </div>

      {/* Confirmed banner */}
      {orderConfirmed && (
        <div className="mb-6 flex items-start gap-3 px-5 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
          <CheckCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Order Confirmed!</p>
            <p className="text-xs opacity-70 mt-0.5">Thank you — your sales representative will be in touch to finalise delivery details.</p>
          </div>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Grand Total', value: fmt(quotation.grandTotal), highlight: true },
          { label: 'Quoted On', value: fmtDate(quotation.createdAt) },
          { label: 'Last Updated', value: timeAgo(quotation.updatedAt) },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className={`text-lg font-bold mt-1 ${s.highlight ? 'text-white' : 'text-zinc-200'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Notes from sales rep */}
      {quotation.notes && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl px-5 py-4 flex items-start gap-3 mb-6">
          <FileText size={15} className="text-zinc-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-1">Notes from Sales Team</p>
            <p className="text-sm text-zinc-300">{quotation.notes}</p>
          </div>
        </div>
      )}

      {/* Line Items */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
          <FileText size={14} /> Quoted Items
        </h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-left">
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Unit Price</th>
                <th className="px-5 py-3 font-medium">Discount</th>
                <th className="px-5 py-3 font-medium text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {quotation.lines.map(line => (
                <tr key={line.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition">
                  <td className="px-5 py-3 text-zinc-500">{line.lineNumber}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-zinc-100">{line.productName}</p>
                    <div className="mt-0.5"><CategoryBadge cat={line.category} /></div>
                  </td>
                  <td className="px-5 py-3 text-zinc-300">{line.quantity}</td>
                  <td className="px-5 py-3 text-zinc-300">{fmt(line.unitPrice)}</td>
                  <td className="px-5 py-3">
                    {parseFloat(line.discountPercent) > 0 ? (
                      <span className="text-emerald-400 font-semibold">{parseFloat(line.discountPercent).toFixed(1)}%</span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-zinc-100">{fmt(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals footer */}
          <div className="border-t border-zinc-800 px-5 py-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span><span>{fmt(quotation.subtotal)}</span>
            </div>
            {parseFloat(quotation.discountAmount) > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>Discounts</span><span className="text-emerald-400">-{fmt(quotation.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-400">
              <span>Tax (GST)</span><span>{fmt(quotation.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-white text-base pt-2 border-t border-zinc-800">
              <span>Grand Total</span><span>{fmt(quotation.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Negotiation Panel */}
      {canNegotiate && !requestSubmitted && !orderConfirmed && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-zinc-200 mb-1 flex items-center gap-2">
            <MessageSquare size={14} /> Request a Change
          </h2>
          <p className="text-xs text-zinc-500 mb-4">
            Not happy with the pricing or terms? Describe your request and your sales rep will get back to you.
          </p>
          <textarea
            id="counter-offer-textarea"
            value={counterNote}
            onChange={e => setCounterNote(e.target.value)}
            placeholder="e.g. I'd like to request an additional 5% discount on the Hardware items, or swap the Setup Service for Remote Onboarding…"
            rows={4}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500 resize-none transition mb-3"
          />
          <button
            id="submit-negotiation-btn"
            onClick={handleSubmitRequest}
            disabled={submittingRequest || !counterNote.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={13} /> {submittingRequest ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      )}

      {requestSubmitted && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl px-5 py-4 flex items-start gap-3 mb-6">
          <CheckCircle size={18} className="text-sky-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-sky-300">Request Submitted</p>
            <p className="text-xs text-sky-400/70 mt-0.5">Your sales rep will review and come back to you shortly.</p>
          </div>
        </div>
      )}

      {/* Confirm Order */}
      {canConfirm && !orderConfirmed && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-emerald-300 mb-1 flex items-center gap-2">
            <CheckCircle size={14} /> Ready to Confirm?
          </h2>
          <p className="text-xs text-emerald-400/70 mb-4">
            Your quotation has been approved. Click below to confirm the order and begin fulfilment.
          </p>
          <button
            id="confirm-order-btn"
            onClick={handleConfirmOrder}
            disabled={confirmingOrder}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle size={15} /> {confirmingOrder ? 'Confirming…' : 'Confirm Order'}
          </button>
        </div>
      )}
    </div>
  );
}
