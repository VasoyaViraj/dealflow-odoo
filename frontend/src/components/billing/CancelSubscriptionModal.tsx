import { useState } from 'react';
import { X, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';
import type { Subscription } from '../../types/billing';

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  });
}

interface CancelSubscriptionModalProps {
  subscription: Subscription;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function CancelSubscriptionModal({
  subscription, onClose, onSuccess, showToast,
}: CancelSubscriptionModalProps) {
  const [reason, setReason]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState<{ creditAmount: string } | null>(null);

  // Estimate credit for remaining days in current period
  const periodStart   = new Date(subscription.currentPeriodStart).getTime();
  const periodEnd     = new Date(subscription.currentPeriodEnd).getTime();
  const now           = Date.now();
  const totalDays     = Math.ceil((periodEnd - periodStart) / 86_400_000);
  const remainingDays = Math.max(0, Math.ceil((periodEnd - now) / 86_400_000));
  const estimatedCredit = (Number(subscription.cycleAmount) * remainingDays / totalDays);

  const handleCancel = async () => {
    if (!reason.trim()) {
      showToast('Please provide a cancellation reason', 'error');
      return;
    }
    setLoading(true);
    try {
      const r = await api.post(`/subscriptions/${subscription.id}/cancel`, { reason });
      const credit = r.data.data.creditAmount;
      setDone({ creditAmount: credit });
      showToast('Subscription cancelled successfully');
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to cancel subscription';
      showToast(msg, 'error');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm">
      <div className="bg-canvas border border-hairline rounded-lg w-full max-w-md mx-4 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-hairline">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-coral/8 border border-coral/30 flex items-center justify-center">
              <XCircle size={15} className="text-coral" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Cancel Subscription</p>
              <p className="text-xs text-subtle">{subscription.productName} · {subscription.subscriptionNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-subtle hover:text-ink transition-colors p-1 rounded-lg hover:bg-soft"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5">
          {!done ? (
            <>
              {/* Warning */}
              <div className="bg-coral/8 border border-coral/30 rounded-md px-4 py-3 mb-4 flex items-start gap-2">
                <AlertTriangle size={14} className="text-coral shrink-0 mt-0.5" />
                <p className="text-xs text-coral">
                  This action is permanent. The subscription will be cancelled immediately and all
                  future billing schedule entries will be skipped.
                </p>
              </div>

              {/* Credit estimate */}
              {remainingDays > 0 && (
                <div className="bg-success/10 border border-success/30 rounded-md px-4 py-3 mb-4 text-xs text-success">
                  <p className="font-semibold mb-0.5">Estimated credit note</p>
                  <p className="text-success">
                    {remainingDays} remaining day{remainingDays !== 1 ? 's' : ''} → ~{fmt(estimatedCredit)} credit
                  </p>
                </div>
              )}

              {/* Reason */}
              <label className="block text-sm font-medium text-body mb-2">
                Cancellation reason <span className="text-coral">*</span>
              </label>
              <textarea
                id="cancel-reason-textarea"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Customer switching to annual plan, project ended…"
                rows={3}
                className="w-full bg-soft border border-hairline rounded-md px-4 py-3 text-sm text-ink placeholder-line-strong focus:outline-none focus:border-coral resize-none transition mb-4"
              />

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 bg-soft border border-hairline text-body hover:text-ink rounded-md text-sm font-medium transition"
                >
                  Keep Subscription
                </button>
                <button
                  id="confirm-cancel-sub-btn"
                  onClick={handleCancel}
                  disabled={loading || !reason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-coral /90 text-white rounded-md text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  {loading ? 'Cancelling…' : 'Cancel Subscription'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-lg bg-success/10 border border-success/30 flex items-center justify-center">
                <XCircle size={22} className="text-success" />
              </div>
              <p className="text-sm font-semibold text-success">Subscription Cancelled</p>
              {parseFloat(done.creditAmount) > 0 && (
                <p className="text-xs text-success">
                  Credit note of {fmt(done.creditAmount)} issued
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
