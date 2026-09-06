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
import Loader from '../components/ui/Loader';
import Pagination from '../components/ui/Pagination';

type ActiveTab = 'approvals' | 'invoices';

export default function FinanceDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('approvals');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [queuePage, setQueuePage] = useState(1);
  const [queueTotalPages, setQueueTotalPages] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceTotalPages, setInvoiceTotalPages] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadQueue = useCallback(async (page = 1, searchQuery = search, sortField = sortBy, order = sortOrder) => {
    try {
      const r = await api.get('/approval-queue', { 
        params: { 
          limit: 12, 
          page, 
          search: searchQuery || undefined,
          sortBy: sortField,
          sortOrder: order
        } 
      });
      setQueue(r.data.data);
      if (r.data.pagination) {
        setQueueTotalPages(r.data.pagination.totalPages || 1);
        setQueuePage(r.data.pagination.page || 1);
      }
    } catch {
      // handled by interceptor
    } finally {
      setLoadingQueue(false);
      setRefreshing(false);
    }
  }, []);

  const loadInvoices = useCallback(async (page = 1) => {
    setLoadingInvoices(true);
    try {
      const r = await api.get('/invoices', { params: { limit: 12, page } });
      setInvoices(r.data.data);
      if (r.data.pagination) {
        setInvoiceTotalPages(r.data.pagination.totalPages || 1);
        setInvoicePage(r.data.pagination.page || 1);
      }
    } catch {
      // silently fail — billing may not have started yet
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => { loadQueue(1, search, sortBy, sortOrder); }, [loadQueue, search, sortBy, sortOrder]);
  useEffect(() => { loadInvoices(1); }, [loadInvoices]);

  const refresh = () => {
    setRefreshing(true);
    loadQueue(queuePage, search, sortBy, sortOrder);
    loadInvoices(invoicePage);
  };

  const handleDecision = () => {
    setSelectedId(null);
    loadQueue(queuePage);
  };

  const handlePayInvoice = async (invoice: Invoice) => {
    setPayingId(invoice.id);
    try {
      await api.post(`/invoices/${invoice.id}/pay`);
      showToast(`Invoice ${invoice.invoiceNumber} marked as PAID`);
      loadInvoices(invoicePage);
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
            <h1 className="text-2xl font-bold text-ink">Finance Dashboard</h1>
            <p className="text-subtle text-sm mt-1">
              Approvals and billing — your two sign-off queues
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-soft border border-hairline text-body hover:text-ink rounded-lg text-sm transition-all"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-canvas border border-hairline rounded-md p-1 w-fit mb-6">
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
 ? 'bg-ink text-white'
 : 'text-subtle hover:text-ink'
 }`}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.badge > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${
 activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-strong text-body'
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
            <div className="flex items-center justify-between mb-4">
              <div className="bg-mustard/20 border border-mustard/60 rounded-md px-5 py-4 flex items-start gap-3 w-full max-w-2xl">
                <ShieldAlert size={18} className="text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-warning">High-Risk Deals Only</p>
                  <p className="text-xs text-warning mt-1">
                    Deals appear here only after Sales Manager approval when the risk score requires Finance sign-off.
                    Every action is permanently recorded in the audit trail.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end mb-4">
                <select 
                  value={sortBy} 
                  onChange={e => setSortBy(e.target.value)}
                  className="bg-canvas border border-hairline rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-ink"
                >
                  <option value="updatedAt">Date Updated</option>
                  <option value="grandTotal">Grand Total</option>
                  <option value="riskScore">Risk Score</option>
                </select>
                <select 
                  value={sortOrder} 
                  onChange={e => setSortOrder(e.target.value)}
                  className="bg-canvas border border-hairline rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-ink"
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
                <input
                  type="text"
                  placeholder="Filter by customer name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-canvas border border-hairline rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-ink min-w-48"
                />
              </div>
            </div>

            {loadingQueue ? (
              <div className="py-20"><Loader loading={true} /></div>
            ) : queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-16 h-16 rounded-lg bg-mustard/20 border border-mustard/60 flex items-center justify-center mb-4">
                  <DollarSign size={28} className="text-warning" />
                </div>
                <h2 className="text-lg font-semibold text-ink">No deals pending</h2>
                <p className="text-subtle text-sm mt-2 max-w-sm">
                  No high-risk quotations are awaiting Finance approval right now.
                </p>
              </div>
            ) : (
              <>
                <ApprovalQueue
                  items={queue}
                  onReview={(id) => setSelectedId(id)}
                  accentColor="amber"
                />
                {!loadingQueue && queue.length > 0 && (
                  <div className="mt-6">
                    <Pagination currentPage={queuePage} totalPages={queueTotalPages} onPageChange={loadQueue} />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Invoices Tab ──────────────────────────────────── */}
        {activeTab === 'invoices' && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Pending Payment', count: pendingInvoices.length,  total: pendingInvoices.reduce((s, i) => s + Number(i.grandTotal), 0),  color: 'text-link',     bg: 'bg-link/10 border-link/30'    },
                { label: 'Paid',            count: paidInvoices.length,     total: paidInvoices.reduce((s, i) => s + Number(i.grandTotal), 0),      color: 'text-success', bg: 'bg-success/10 border-success/30' },
                { label: 'Cancelled',       count: cancelledInvoices.length, total: cancelledInvoices.reduce((s, i) => s + Number(i.grandTotal), 0), color: 'text-subtle',    bg: 'bg-soft border-hairline'        },
              ].map(s => (
                <div key={s.label} className={`rounded-lg border px-5 py-4 ${s.bg}`}>
                  <p className="text-xs text-subtle">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.count}</p>
                  <p className="text-xs text-subtle mt-1">
                    {s.total.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                  </p>
                </div>
              ))}
            </div>

            {loadingInvoices ? (
              <div className="py-20"><Loader loading={true} /></div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-lg bg-link/10 border border-link/30 flex items-center justify-center mb-4">
                  <ReceiptText size={28} className="text-link" />
                </div>
                <h2 className="text-lg font-semibold text-ink">No invoices yet</h2>
                <p className="text-subtle text-sm mt-2 max-w-sm">
                  Once a sales rep generates an invoice from an approved quotation, it will appear here for payment recording.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pending first */}
                {pendingInvoices.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard size={14} className="text-link" />
                      <p className="text-sm font-semibold text-body">
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
                    <p className="text-xs font-semibold text-subtle uppercase tracking-wider mb-3">Paid</p>
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
                    <p className="text-xs font-semibold text-subtle uppercase tracking-wider mb-3">Cancelled</p>
                    <div className="space-y-3">
                      {cancelledInvoices.map(inv => (
                        <InvoiceCard key={inv.id} invoice={inv} canPay={false} />
                      ))}
                    </div>
                  </div>
                )}

                {!loadingInvoices && invoices.length > 0 && (
                  <div className="mt-6">
                    <Pagination currentPage={invoicePage} totalPages={invoiceTotalPages} onPageChange={loadInvoices} />
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
