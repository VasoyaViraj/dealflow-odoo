import { useState } from 'react';
import { ArrowLeft, CheckCircle, FileText, Send, MessageSquare } from 'lucide-react';
import api from '../../lib/api';
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
    try {
      await api.post(`/quotations/${quotation.id}/negotiate`, { note: counterNote });
      setRequestSubmitted(true);
      setCounterNote('');
      showToast('Negotiation request submitted — your sales rep will follow up');
    } catch {
      showToast('Failed to submit negotiation request', 'error');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleConfirmOrder = async () => {
    setConfirmingOrder(true);
    try {
      await api.post(`/quotations/${quotation.id}/confirm`);
      setOrderConfirmed(true);
      showToast('Order confirmed — your sales rep has been notified');
    } catch {
      showToast('Failed to confirm order', 'error');
    } finally {
      setConfirmingOrder(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-subtle hover:text-ink transition">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="w-px h-5 bg-soft" />
        <div className="flex-1">
          <p className="text-xs text-subtle font-mono">{quotation.quotationNumber}</p>
          <h1 className="text-xl font-bold text-ink">{quotation.customer?.name}</h1>
        </div>
        <StatusBadge status={quotation.status} />
      </div>

      {/* Confirmed banner */}
      {orderConfirmed && (
        <div className="mb-6 flex items-start gap-3 px-5 py-4 rounded-md bg-success/10 border border-success/30 text-success">
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
          <div key={s.label} className="bg-canvas border border-hairline rounded-md px-5 py-4">
            <p className="text-xs text-subtle">{s.label}</p>
            <p className={`text-lg font-bold mt-1 ${s.highlight ? 'text-ink' : 'text-ink'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Notes from sales rep */}
      {quotation.notes && (
        <div className="bg-soft border border-hairline rounded-md px-5 py-4 flex items-start gap-3 mb-6">
          <FileText size={15} className="text-subtle shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-subtle mb-1">Notes from Sales Team</p>
            <p className="text-sm text-body">{quotation.notes}</p>
          </div>
        </div>
      )}

      {/* Line Items */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
          <FileText size={14} /> Quoted Items
        </h2>
        <div className="bg-canvas border border-hairline rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-subtle text-left">
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
                <tr key={line.id} className="border-b border-hairline hover:bg-soft transition">
                  <td className="px-5 py-3 text-subtle">{line.lineNumber}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink">{line.productName}</p>
                    <div className="mt-0.5"><CategoryBadge cat={line.category} /></div>
                  </td>
                  <td className="px-5 py-3 text-body">{line.quantity}</td>
                  <td className="px-5 py-3 text-body">{fmt(line.unitPrice)}</td>
                  <td className="px-5 py-3">
                    {parseFloat(line.discountPercent) > 0 ? (
                      <span className="text-success font-semibold">{parseFloat(line.discountPercent).toFixed(1)}%</span>
                    ) : (
                      <span className="text-line-strong">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-ink">{fmt(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals footer */}
          <div className="border-t border-hairline px-5 py-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-subtle">
              <span>Subtotal</span><span>{fmt(quotation.subtotal)}</span>
            </div>
            {parseFloat(quotation.discountAmount) > 0 && (
              <div className="flex justify-between text-subtle">
                <span>Discounts</span><span className="text-success">-{fmt(quotation.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-subtle">
              <span>Tax (GST)</span><span>{fmt(quotation.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-ink text-base pt-2 border-t border-hairline">
              <span>Grand Total</span><span>{fmt(quotation.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Negotiation Panel */}
      {canNegotiate && !requestSubmitted && !orderConfirmed && (
        <div className="bg-canvas border border-hairline rounded-lg p-6 mb-6">
          <h2 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
            <MessageSquare size={14} /> Request a Change
          </h2>
          <p className="text-xs text-subtle mb-4">
            Not happy with the pricing or terms? Describe your request and your sales rep will get back to you.
          </p>
          <textarea
            id="counter-offer-textarea"
            value={counterNote}
            onChange={e => setCounterNote(e.target.value)}
            placeholder="e.g. I'd like to request an additional 5% discount on the Hardware items, or swap the Setup Service for Remote Onboarding…"
            rows={4}
            className="w-full bg-soft border border-hairline rounded-md px-4 py-3 text-sm text-ink placeholder-line-strong focus:outline-none focus:border-link resize-none transition mb-3"
          />
          <button
            id="submit-negotiation-btn"
            onClick={handleSubmitRequest}
            disabled={submittingRequest || !counterNote.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-link -active text-ink text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={13} /> {submittingRequest ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      )}

      {requestSubmitted && (
        <div className="bg-link/10 border border-link/30 rounded-md px-5 py-4 flex items-start gap-3 mb-6">
          <CheckCircle size={18} className="text-link shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-link">Request Submitted</p>
            <p className="text-xs text-link mt-0.5">Your sales rep will review and come back to you shortly.</p>
          </div>
        </div>
      )}

      {/* Confirm Order */}
      {canConfirm && !orderConfirmed && (
        <div className="bg-success/10 border border-success/30 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-success mb-1 flex items-center gap-2">
            <CheckCircle size={14} /> Ready to Confirm?
          </h2>
          <p className="text-xs text-success mb-4">
            Your quotation has been approved. Click below to confirm the order and begin fulfilment.
          </p>
          <button
            id="confirm-order-btn"
            onClick={handleConfirmOrder}
            disabled={confirmingOrder}
            className="flex items-center gap-2 px-6 py-3 bg-success /90 text-white font-semibold rounded-md text-sm shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle size={15} /> {confirmingOrder ? 'Confirming…' : 'Confirm Order'}
          </button>
        </div>
      )}
    </div>
  );
}
