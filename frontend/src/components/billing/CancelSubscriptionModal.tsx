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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <XCircle size={15} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Cancel Subscription</p>
              <p className="text-xs text-zinc-500">{subscription.productName} · {subscription.subscriptionNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded-lg hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5">
          {!done ? (
            <>
              {/* Warning */}
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">
                  This action is permanent. The subscription will be cancelled immediately and all
                  future billing schedule entries will be skipped.
                </p>
              </div>

              {/* Credit estimate */}
              {remainingDays > 0 && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4 text-xs text-emerald-300">
                  <p className="font-semibold mb-0.5">Estimated credit note</p>
                  <p className="text-emerald-400/80">
                    {remainingDays} remaining day{remainingDays !== 1 ? 's' : ''} → ~{fmt(estimatedCredit)} credit
                  </p>
                </div>
              )}

              {/* Reason */}
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Cancellation reason <span className="text-red-400">*</span>
              </label>
              <textarea
                id="cancel-reason-textarea"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Customer switching to annual plan, project ended…"
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-red-500 resize-none transition mb-4"
              />

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-sm font-medium transition"
                >
                  Keep Subscription
                </button>
                <button
                  id="confirm-cancel-sub-btn"
                  onClick={handleCancel}
                  disabled={loading || !reason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  {loading ? 'Cancelling…' : 'Cancel Subscription'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <XCircle size={22} className="text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-emerald-300">Subscription Cancelled</p>
              {parseFloat(done.creditAmount) > 0 && (
                <p className="text-xs text-emerald-400/80">
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
