import { useState } from 'react';
import { X, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import type { Subscription, ProratePreview } from '../../types/billing';

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  });
}

interface ProrationModalProps {
  subscription: Subscription;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type Step = 'input' | 'preview' | 'confirming' | 'done';

export function ProrationModal({ subscription, onClose, onSuccess, showToast }: ProrationModalProps) {
  const [step, setStep]             = useState<Step>('input');
  const [newQty, setNewQty]         = useState(subscription.quantity);
  const [preview, setPreview]       = useState<ProratePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const cycleGross = Number(subscription.cycleAmount) * (1 + Number(subscription.taxRate) / 100);
  const newCycleGross = (newQty / subscription.quantity) * cycleGross;

  const handlePreview = async () => {
    if (newQty === subscription.quantity) {
      showToast('New quantity is the same as current', 'error');
      return;
    }
    setLoadingPreview(true);
    try {
      const r = await api.post(`/subscriptions/${subscription.id}/prorate`, { quantity: newQty });
      setPreview(r.data.data);
      setStep('preview');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to calculate proration';
      showToast(msg, 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirm = async () => {
    setStep('confirming');
    try {
      await api.post(`/subscriptions/${subscription.id}/modify`, { quantity: newQty });
      setStep('done');
      showToast('Subscription updated with proration applied');
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to modify subscription';
      showToast(msg, 'error');
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <TrendingUp size={15} className="text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Modify Subscription</p>
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
          {/* Step: Input */}
          {step === 'input' && (
            <>
              <div className="bg-zinc-800/50 rounded-xl px-4 py-3 mb-5 text-sm">
                <div className="flex justify-between text-zinc-400 mb-1">
                  <span>Current quantity</span>
                  <span className="text-zinc-200 font-medium">{subscription.quantity} seats</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Current cycle amount</span>
                  <span className="text-violet-300 font-medium">{fmt(cycleGross)} / {subscription.billingCycle.toLowerCase()}</span>
                </div>
              </div>

              <label className="block text-sm font-medium text-zinc-300 mb-2">
                New quantity <span className="text-zinc-500 font-normal">(seats)</span>
              </label>
              <div className="flex items-center gap-3 mb-5">
                <button
                  onClick={() => setNewQty(q => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700 transition flex items-center justify-center text-lg font-bold"
                >
                  −
                </button>
                <input
                  id="new-qty-input"
                  type="number"
                  min={1}
                  value={newQty}
                  onChange={e => setNewQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-center text-lg font-bold text-white focus:outline-none focus:border-violet-500 transition"
                />
                <button
                  onClick={() => setNewQty(q => q + 1)}
                  className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700 transition flex items-center justify-center text-lg font-bold"
                >
                  +
                </button>
              </div>

              {newQty !== subscription.quantity && (
                <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl px-4 py-3 mb-4 text-xs text-zinc-400">
                  New cycle amount will be approx{' '}
                  <span className="text-violet-300 font-semibold">{fmt(newCycleGross)}</span>
                  {' '}/ {subscription.billingCycle.toLowerCase()}
                </div>
              )}

              <button
                id="preview-proration-btn"
                onClick={handlePreview}
                disabled={loadingPreview || newQty === subscription.quantity}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingPreview ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                {loadingPreview ? 'Calculating…' : 'Preview Proration'}
              </button>
            </>
          )}

          {/* Step: Preview */}
          {step === 'preview' && preview && (
            <>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  Mid-cycle proration applies: you'll be credited for the old quantity and charged for the new quantity for the remaining <strong>{preview.remainingDays} days</strong> of the current period.
                </p>
              </div>

              <div className="space-y-3 mb-5">
                {[
                  { label: 'Credit for current qty', value: `−${fmt(preview.credit)}`, cls: 'text-emerald-400' },
                  { label: 'Charge for new qty', value: `+${fmt(preview.newCharge)}`, cls: 'text-amber-300' },
                  { label: 'Net adjustment', value: parseFloat(preview.proratedAmount) < 0
                    ? `−${fmt(Math.abs(parseFloat(preview.proratedAmount)))} credit`
                    : `+${fmt(preview.proratedAmount)} charge`,
                    cls: parseFloat(preview.proratedAmount) < 0 ? 'text-emerald-300' : 'text-amber-300',
                    big: true,
                  },
                ].map(r => (
                  <div key={r.label} className={`flex justify-between items-center text-sm ${r.big ? 'border-t border-zinc-800 pt-3 font-bold' : ''}`}>
                    <span className="text-zinc-400">{r.label}</span>
                    <span className={r.cls}>{r.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('input')}
                  className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-sm font-medium transition"
                >
                  Back
                </button>
                <button
                  id="confirm-modification-btn"
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition"
                >
                  Confirm Change
                </button>
              </div>
            </>
          )}

          {/* Step: Confirming */}
          {step === 'confirming' && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 size={28} className="text-violet-400 animate-spin" />
              <p className="text-sm text-zinc-400">Applying modification…</p>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <TrendingUp size={22} className="text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-emerald-300">Subscription Updated</p>
              <p className="text-xs text-zinc-500">Billing schedule refreshed</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
