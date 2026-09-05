import { useState, useEffect, useCallback } from 'react';
import AppShell from '../components/layout/AppShell';
import ApprovalQueue from '../components/approvals/ApprovalQueue';
import ApprovalReviewDrawer from '../components/approvals/ApprovalReviewDrawer';
import { InvoiceCard } from '../components/billing/InvoiceCard';
import { DollarSign, RefreshCw, ShieldAlert, ReceiptText, CreditCard } from 'lucide-react';
import api from '../lib/api';
import type { QueueItem } from './ManagerDashboard';
import type { Invoice } from '../types/billing';
import { Toast } from '../components/ui/Toast';

type ActiveTab = 'approvals' | 'invoices';

export default function FinanceDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('approvals');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const r = await api.get('/approval-queue');
      setQueue(r.data.data);
    } catch {
      // handled by interceptor
    } finally {
      setLoadingQueue(false);
      setRefreshing(false);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const r = await api.get('/invoices', { params: { limit: 50 } });
      setInvoices(r.data.data);
    } catch {
      // silently fail — billing may not have started yet
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const refresh = () => {
    setRefreshing(true);
    loadQueue();
    loadInvoices();
  };

  const handleDecision = () => {
    setSelectedId(null);
    loadQueue();
  };

  const handlePayInvoice = async (invoice: Invoice) => {
    setPayingId(invoice.id);
    try {
      await api.post(`/invoices/${invoice.id}/pay`);
      showToast(`Invoice ${invoice.invoiceNumber} marked as PAID`);
      loadInvoices();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to record payment';
      showToast(msg, 'error');
    } finally {
      setPayingId(null);
    }
  };

  const pendingInvoices  = invoices.filter(i => i.status === 'ISSUED');
  const paidInvoices     = invoices.filter(i => i.status === 'PAID');
  const cancelledInvoices = invoices.filter(i => i.status === 'CANCELLED');

  return (
    <AppShell>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Finance Dashboard</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Approvals and billing — your two sign-off queues
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded-lg text-sm transition-all"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit mb-6">
          {([
            { key: 'approvals', label: 'Approval Queue', icon: ShieldAlert, badge: queue.length },
            { key: 'invoices',  label: 'Invoices',       icon: ReceiptText, badge: pendingInvoices.length },
          ] as const).map(tab => (
            <button
              key={tab.key}
              id={`finance-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-zinc-700 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.badge > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${
                  activeTab === tab.key ? 'bg-amber-500 text-black' : 'bg-zinc-700 text-zinc-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Approvals Tab ─────────────────────────────────── */}
        {activeTab === 'approvals' && (
          <>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 flex items-start gap-3 mb-6">
              <ShieldAlert size={18} className="text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-300">High-Risk Deals Only</p>
                <p className="text-xs text-amber-400/80 mt-1">
                  Deals appear here only after Sales Manager approval when the risk score requires Finance sign-off.
                  Every action is permanently recorded in the audit trail.
                </p>
              </div>
            </div>

            {loadingQueue ? (
              <div className="flex items-center justify-center py-32 text-zinc-500">
                <RefreshCw size={20} className="animate-spin mr-3" />
                Loading queue…
              </div>
            ) : queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                  <DollarSign size={28} className="text-amber-400" />
                </div>
                <h2 className="text-lg font-semibold text-zinc-200">No deals pending</h2>
                <p className="text-zinc-500 text-sm mt-2 max-w-sm">
                  No high-risk quotations are awaiting Finance approval right now.
                </p>
              </div>
            ) : (
              <ApprovalQueue
                items={queue}
                onReview={(id) => setSelectedId(id)}
                accentColor="amber"
              />
            )}
          </>
        )}

        {/* ── Invoices Tab ──────────────────────────────────── */}
        {activeTab === 'invoices' && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Pending Payment', count: pendingInvoices.length,  total: pendingInvoices.reduce((s, i) => s + Number(i.grandTotal), 0),  color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/20'    },
                { label: 'Paid',            count: paidInvoices.length,     total: paidInvoices.reduce((s, i) => s + Number(i.grandTotal), 0),      color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                { label: 'Cancelled',       count: cancelledInvoices.length, total: cancelledInvoices.reduce((s, i) => s + Number(i.grandTotal), 0), color: 'text-zinc-500',    bg: 'bg-zinc-800 border-zinc-700'        },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl border px-5 py-4 ${s.bg}`}>
                  <p className="text-xs text-zinc-500">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.count}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {s.total.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                  </p>
                </div>
              ))}
            </div>

            {loadingInvoices ? (
              <div className="flex items-center justify-center py-16 text-zinc-500">
                <RefreshCw size={20} className="animate-spin mr-3" />
                Loading invoices…
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-4">
                  <ReceiptText size={28} className="text-sky-400" />
                </div>
                <h2 className="text-lg font-semibold text-zinc-200">No invoices yet</h2>
                <p className="text-zinc-500 text-sm mt-2 max-w-sm">
                  Once a sales rep generates an invoice from an approved quotation, it will appear here for payment recording.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pending first */}
                {pendingInvoices.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard size={14} className="text-sky-400" />
                      <p className="text-sm font-semibold text-zinc-300">
                        Pending Payment ({pendingInvoices.length})
                      </p>
                    </div>
                    <div className="space-y-3">
                      {pendingInvoices.map(inv => (
                        <InvoiceCard
                          key={inv.id}
                          invoice={inv}
                          canPay
                          onPay={() => handlePayInvoice(inv)}
                          paying={payingId === inv.id}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Paid invoices */}
                {paidInvoices.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Paid</p>
                    <div className="space-y-3">
                      {paidInvoices.map(inv => (
                        <InvoiceCard key={inv.id} invoice={inv} canPay={false} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Cancelled invoices */}
                {cancelledInvoices.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Cancelled</p>
                    <div className="space-y-3">
                      {cancelledInvoices.map(inv => (
                        <InvoiceCard key={inv.id} invoice={inv} canPay={false} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selectedId && (
        <ApprovalReviewDrawer
          quotationId={selectedId}
          approverRole="FINANCE_OPERATIONS"
          onClose={() => setSelectedId(null)}
          onDecision={handleDecision}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </AppShell>
  );
}
