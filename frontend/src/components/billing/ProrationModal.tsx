import { useState, useEffect } from 'react';
import { X, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import type { Subscription, ProratePreview, SubscriptionPlan } from '../../types/billing';

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
  const [newPlanId, setNewPlanId]   = useState(subscription.subscriptionPlanId || '');
  const [plans, setPlans]           = useState<SubscriptionPlan[]>([]);
  const [preview, setPreview]       = useState<ProratePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    api.get('/products/subscription-plans').then(r => setPlans(r.data.data)).catch(() => {});
  }, []);

  const selectedPlan = plans.find(p => p.id === newPlanId);
  const newCycleGross = selectedPlan
    ? (newQty / subscription.quantity) * Number(subscription.cycleAmount) * (1 + Number(subscription.taxRate) / 100) * (Number(selectedPlan.priceMultiplier) / Number(plans.find(p => p.id === subscription.subscriptionPlanId)?.priceMultiplier || 1))
    : (newQty / subscription.quantity) * Number(subscription.cycleAmount) * (1 + Number(subscription.taxRate) / 100);

  const handlePreview = async () => {
    if (newQty === subscription.quantity && newPlanId === (subscription.subscriptionPlanId || '')) {
      showToast('No changes made', 'error');
      return;
    }
    setLoadingPreview(true);
    try {
      const r = await api.post(`/subscriptions/${subscription.id}/prorate`, { quantity: newQty, planId: newPlanId });
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
      await api.post(`/subscriptions/${subscription.id}/modify`, { quantity: newQty, planId: newPlanId });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm">
      <div className="bg-canvas border border-hairline rounded-lg w-full max-w-md mx-4 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-hairline">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-cream border border-hairline flex items-center justify-center">
              <TrendingUp size={15} className="text-link" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Modify Subscription</p>
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
          {/* Step: Input */}
          {step === 'input' && (
            <>
              <div className="bg-soft rounded-md px-4 py-3 mb-5 text-sm">
                <div className="flex justify-between text-subtle mb-1">
                  <span>Current quantity</span>
                  <span className="text-ink font-medium">{subscription.quantity} seats</span>
                </div>
                <div className="flex justify-between text-subtle">
                  <span>Current cycle amount</span>
                  <span className="text-link font-medium">
                    {fmt(Number(subscription.cycleAmount) * (1 + Number(subscription.taxRate) / 100))} / {subscription.billingCycle.toLowerCase()}
                  </span>
                </div>
              </div>

              <div className="flex gap-4 mb-5">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-body mb-2">
                    New quantity <span className="text-subtle font-normal">(seats)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setNewQty(q => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-md bg-soft border border-hairline text-body hover:text-ink hover:bg-strong transition flex items-center justify-center text-lg font-bold"
                    >
                      −
                    </button>
                    <input
                      id="new-qty-input"
                      type="number"
                      min={1}
                      value={newQty}
                      onChange={e => setNewQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 w-20 bg-soft border border-hairline rounded-md px-2 py-2 text-center text-lg font-bold text-ink focus:outline-none focus:border-ink transition"
                    />
                    <button
                      onClick={() => setNewQty(q => q + 1)}
                      className="w-10 h-10 rounded-md bg-soft border border-hairline text-body hover:text-ink hover:bg-strong transition flex items-center justify-center text-lg font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium text-body mb-2">
                    Billing Cycle
                  </label>
                  <select
                    value={newPlanId}
                    onChange={e => setNewPlanId(e.target.value)}
                    className="w-full h-10 bg-soft border border-hairline rounded-md px-3 text-sm text-ink focus:outline-none focus:border-ink transition"
                  >
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.billingCycle})</option>
                    ))}
                  </select>
                </div>
              </div>

              {(newQty !== subscription.quantity || newPlanId !== subscription.subscriptionPlanId) && (
                <div className="bg-soft border border-hairline rounded-md px-4 py-3 mb-4 text-xs text-subtle">
                  New cycle amount will be approx{' '}
                  <span className="text-link font-semibold">{fmt(newCycleGross || 0)}</span>
                  {' '}/ {selectedPlan?.billingCycle?.toLowerCase() || subscription.billingCycle.toLowerCase()}
                </div>
              )}

              <button
                id="preview-proration-btn"
                onClick={handlePreview}
                disabled={loadingPreview || (newQty === subscription.quantity && newPlanId === (subscription.subscriptionPlanId || ''))}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-ink hover:bg-ink-active text-white text-sm font-semibold rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingPreview ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                {loadingPreview ? 'Calculating…' : 'Preview Proration'}
              </button>
            </>
          )}

          {/* Step: Preview */}
          {step === 'preview' && preview && (
            <>
              <div className="bg-mustard/20 border border-mustard/60 rounded-md px-4 py-3 mb-4 flex items-start gap-2">
                <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning">
                  Mid-cycle proration applies: you'll be credited for the old quantity and charged for the new quantity for the remaining <strong>{preview.remainingDays} days</strong> of the current period.
                </p>
              </div>

              <div className="space-y-3 mb-5">
                {[
                  { label: 'Credit for current qty', value: `−${fmt(preview.credit)}`, cls: 'text-success' },
                  { label: 'Charge for new qty', value: `+${fmt(preview.newCharge)}`, cls: 'text-warning' },
                  { label: 'Net adjustment', value: parseFloat(preview.proratedAmount) < 0
                    ? `−${fmt(Math.abs(parseFloat(preview.proratedAmount)))} credit`
                    : `+${fmt(preview.proratedAmount)} charge`,
                    cls: parseFloat(preview.proratedAmount) < 0 ? 'text-success' : 'text-warning',
 big: true,
 },
 ].map(r => (
 <div key={r.label} className={`flex justify-between items-center text-sm ${r.big ? 'border-t border-hairline pt-3 font-bold' : ''}`}>
 <span className="text-subtle">{r.label}</span>
 <span className={r.cls}>{r.value}</span>
 </div>
 ))}
 </div>

 <div className="flex gap-3">
 <button
 onClick={() => setStep('input')}
 className="flex-1 px-4 py-2.5 bg-soft border border-hairline text-body hover:text-ink rounded-md text-sm font-medium transition"
 >
 Back
 </button>
 <button
 id="confirm-modification-btn"
 onClick={handleConfirm}
 className="flex-1 px-4 py-2.5 bg-ink hover:bg-ink-active text-white rounded-md text-sm font-semibold transition"
 >
 Confirm Change
 </button>
 </div>
 </>
 )}

 {/* Step: Confirming */}
 {step === 'confirming' && (
 <div className="flex flex-col items-center justify-center py-8 gap-3">
 <Loader2 size={28} className="text-link animate-spin" />
 <p className="text-sm text-subtle">Applying modification…</p>
 </div>
 )}

 {/* Step: Done */}
 {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-lg bg-success/10 border border-success/30 flex items-center justify-center">
                <TrendingUp size={22} className="text-success" />
              </div>
              <p className="text-sm font-semibold text-success">Subscription Updated</p>
              <p className="text-xs text-subtle">Billing schedule refreshed</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
