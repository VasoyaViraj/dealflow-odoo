import { useState, useEffect, useCallback } from 'react';
import {
  FileText, RefreshCw, Zap, AlertCircle,
  ReceiptText, CalendarDays,
} from 'lucide-react';
import api from '../../lib/api';
import type { BillingSummary, Subscription } from '../../types/billing';
import { InvoiceCard } from './InvoiceCard';
import { SubscriptionCard } from './SubscriptionCard';
import { BillingScheduleTimeline } from './BillingScheduleTimeline';
import { ProrationModal } from './ProrationModal';
import { CancelSubscriptionModal } from './CancelSubscriptionModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, message }: {
  icon: React.ElementType; title: string; message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-3">
        <Icon size={20} className="text-zinc-500" />
      </div>
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p className="text-xs text-zinc-600 mt-1 max-w-xs">{message}</p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, badge, color }: {
  icon: React.ElementType; title: string; badge?: string; color: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={13} className="text-current" />
      </div>
      <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
      {badge && (
        <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 border border-zinc-700 rounded-full px-2 py-0.5">
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── BillingOverview ─────────────────────────────────────────────────────────

interface BillingOverviewProps {
  quotationId: string;
  /** Which roles the logged-in user has — determines what actions are shown */
  userRole: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function BillingOverview({ quotationId, userRole, showToast }: BillingOverviewProps) {
  const [summary, setSummary]         = useState<BillingSummary | null>(null);
  const [loading, setLoading]         = useState(true);
  const [generatingInv, setGenInv]    = useState(false);
  const [generatingSubs, setGenSubs]  = useState(false);
  const [payingInvoice, setPayingInv] = useState(false);
  const [modifySub, setModifySub]     = useState<Subscription | null>(null);
  const [cancelSub, setCancelSub]     = useState<Subscription | null>(null);
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);

  const canBill      = ['FINANCE_OPERATIONS', 'ADMIN', 'SALES_REPRESENTATIVE', 'SALES_MANAGER'].includes(userRole);
  const canPayInvoice = ['FINANCE_OPERATIONS', 'ADMIN'].includes(userRole);

  const loadSummary = useCallback(async () => {
    try {
      const r = await api.get(`/quotations/${quotationId}/billing`);
      setSummary(r.data.data);
    } catch {
      // silently: the quotation may not have billing yet
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const handleGenerateInvoice = async () => {
    setGenInv(true);
    try {
      await api.post(`/quotations/${quotationId}/billing/invoice`);
      showToast('Invoice generated successfully');
      await loadSummary();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to generate invoice';
      showToast(msg, 'error');
    } finally {
      setGenInv(false);
    }
  };

  const handleGenerateSubscriptions = async () => {
    setGenSubs(true);
    try {
      await api.post(`/quotations/${quotationId}/billing/subscriptions`);
      showToast('Subscriptions created with billing schedule');
      await loadSummary();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to create subscriptions';
      showToast(msg, 'error');
    } finally {
      setGenSubs(false);
    }
  };

  const handleSubscriptionInvoice = async (subscriptionId: string) => {
    try {
      await api.post(`/subscriptions/${subscriptionId}/invoice-next-cycle`);
      showToast('Generated invoice for next cycle');
      loadSummary();
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? 'Failed to generate invoice', 'error');
    }
  };

  const handlePayInvoice = async () => {
    if (!summary?.invoice) return;
    setPayingInv(true);
    try {
      await api.post(`/invoices/${summary.invoice.id}/pay`);
      showToast('Payment recorded — invoice is now PAID');
      await loadSummary();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to record payment';
      showToast(msg, 'error');
    } finally {
      setPayingInv(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <RefreshCw size={20} className="animate-spin mr-3" />
        Loading billing data…
      </div>
    );
  }

  const hasInvoice = !!summary?.invoice;
  const hasSubs    = (summary?.subscriptions.length ?? 0) > 0;
  const activeSubs = summary?.subscriptions.filter(s => s.status === 'ACTIVE') ?? [];

  return (
    <div className="space-y-8">

      {/* ── One-time Invoice Section ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionHeader
            icon={ReceiptText}
            title="One-time Invoice"
            badge={hasInvoice ? summary!.invoice!.status : undefined}
            color="bg-sky-500/10 text-sky-400"
          />
          {canBill && !hasInvoice && (
            <button
              id="generate-invoice-btn"
              onClick={handleGenerateInvoice}
              disabled={generatingInv}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20"
            >
              {generatingInv
                ? <RefreshCw size={12} className="animate-spin" />
                : <FileText size={12} />}
              {generatingInv ? 'Generating…' : 'Generate Invoice'}
            </button>
          )}
        </div>

        {hasInvoice ? (
          <InvoiceCard
            invoice={summary!.invoice!}
            canPay={canPayInvoice}
            onPay={handlePayInvoice}
            paying={payingInvoice}
          />
        ) : (
          <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl">
            <EmptyState
              icon={FileText}
              title="No invoice yet"
              message={canBill
                ? 'Click "Generate Invoice" to create a one-time invoice for hardware and services lines.'
                : 'Invoice not yet generated. Contact your sales representative.'}
            />
          </div>
        )}
      </section>

      {/* ── Subscription Section ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionHeader
            icon={Zap}
            title="Recurring Subscriptions"
            badge={hasSubs ? `${summary!.subscriptions.length} subscription${summary!.subscriptions.length !== 1 ? 's' : ''}` : undefined}
            color="bg-violet-500/10 text-violet-400"
          />
          {canBill && !hasSubs && (
            <button
              id="generate-subscriptions-btn"
              onClick={handleGenerateSubscriptions}
              disabled={generatingSubs}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
            >
              {generatingSubs
                ? <RefreshCw size={12} className="animate-spin" />
                : <Zap size={12} />}
              {generatingSubs ? 'Creating…' : 'Create Subscriptions'}
            </button>
          )}
        </div>

        {hasSubs ? (
          <div className="space-y-4">
            {summary!.subscriptions.map(sub => (
              <div key={sub.id}>
                <SubscriptionCard
                  subscription={sub}
                  canModify={canBill}
                  onModify={() => setModifySub(sub)}
                  onCancel={() => setCancelSub(sub)}
                  onGenerateInvoice={() => handleSubscriptionInvoice(sub.id)}
                />
                {/* Billing schedule for each subscription */}
                {sub.scheduleEntries && sub.scheduleEntries.length > 0 && (
                  <div className="mt-3 ml-4">
                    <button
                      onClick={() => setExpandedSubId(id => id === sub.id ? null : sub.id)}
                      className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition mb-3"
                    >
                      <CalendarDays size={12} />
                      {expandedSubId === sub.id ? 'Hide' : 'Show'} billing schedule
                      ({sub.scheduleEntries.filter(e => e.status === 'UPCOMING').length} upcoming)
                    </button>
                    {expandedSubId === sub.id && (
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl px-5 py-4">
                        <BillingScheduleTimeline entries={sub.scheduleEntries} initialCount={6} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl">
            <EmptyState
              icon={Zap}
              title="No subscriptions yet"
              message={canBill
                ? 'Click "Create Subscriptions" to activate recurring billing for subscription lines.'
                : 'No subscription billing has been set up yet.'}
            />
          </div>
        )}
      </section>

      {/* ── Active subscription summary callout ──────────────────────────── */}
      {activeSubs.length > 0 && (
        <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl px-5 py-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-violet-400 shrink-0 mt-0.5" />
          <div className="text-xs text-violet-300">
            <p className="font-semibold mb-0.5">
              {activeSubs.length} active subscription{activeSubs.length !== 1 ? 's' : ''} running
            </p>
            <p className="text-violet-400/70">
              Combined monthly commitment:{' '}
              <span className="text-violet-200 font-semibold">
                {Number(activeSubs.reduce((sum, s) => sum + Number(s.cycleAmount) * (1 + Number(s.taxRate) / 100), 0))
                  .toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      {modifySub && (
        <ProrationModal
          subscription={modifySub}
          onClose={() => setModifySub(null)}
          onSuccess={() => { setModifySub(null); loadSummary(); }}
          showToast={showToast}
        />
      )}
      {cancelSub && (
        <CancelSubscriptionModal
          subscription={cancelSub}
          onClose={() => setCancelSub(null)}
          onSuccess={() => { setCancelSub(null); loadSummary(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
