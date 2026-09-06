import { useState, useEffect, useCallback } from 'react';
import AppShell from '../components/layout/AppShell';
import ApprovalQueue from '../components/approvals/ApprovalQueue';
import ApprovalReviewDrawer from '../components/approvals/ApprovalReviewDrawer';
import { CheckSquare, RefreshCw, Activity, AlertTriangle, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import api from '../lib/api';
import Loader from '../components/ui/Loader';
import Pagination from '../components/ui/Pagination';

export interface QueueItem {
  id: string;
  customerName: string;
  customerId: string;
  salesRepId: string;
  status: string;
  grandTotal: string;
  riskScore: string;
  approvalLevel: string;
  createdAt: string;
  updatedAt: string;
}

export default function ManagerDashboard() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dealHealth, setDealHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (page = 1) => {
    try {
      const [queueRes, healthRes] = await Promise.all([
        api.get('/approval-queue', { params: { limit: 12, page } }),
        api.get('/dashboard/deal-health')
      ]);
      setQueue(queueRes.data.data);
      if (queueRes.data.pagination) {
        setTotalPages(queueRes.data.pagination.totalPages || 1);
        setCurrentPage(queueRes.data.pagination.page || 1);
      }
      setDealHealth(healthRes.data.data);
    } catch {
      // handled by api interceptor
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load(currentPage);
  };

  const handleDecision = () => {
    setSelectedId(null);
    load(currentPage);
  };

  return (
    <AppShell>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-ink">Manager Dashboard</h1>
            <p className="text-subtle text-sm mt-1">
              Deal Health & Approvals
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

        {loading ? (
          <div className="py-20"><Loader loading={true} /></div>
        ) : (
          <div className="space-y-8">
            {/* Deal Health Section */}
            {dealHealth && (
              <div>
                <h2 className="text-lg font-semibold text-ink mb-4">Deal Health</h2>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-soft border border-hairline p-5 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-subtle">Active Deals</p>
                      <Activity size={16} className="text-link" />
                    </div>
                    <p className="text-3xl font-bold text-ink">{dealHealth.cards.activeDeals}</p>
                  </div>
                  <div className="bg-soft border border-hairline p-5 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-subtle">Pending Approval</p>
                      <Clock size={16} className="text-warning" />
                    </div>
                    <p className="text-3xl font-bold text-ink">{dealHealth.cards.pendingApproval}</p>
                  </div>
                  <div className="bg-soft border border-hairline p-5 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-subtle">At Risk</p>
                      <AlertTriangle size={16} className="text-coral" />
                    </div>
                    <p className="text-3xl font-bold text-coral">{dealHealth.cards.atRisk}</p>
                  </div>
                  <div className="bg-soft border border-hairline p-5 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-medium text-subtle">Stalled</p>
                      <AlertCircle size={16} className="text-subtle" />
                    </div>
                    <p className="text-3xl font-bold text-ink">{dealHealth.cards.stalled}</p>
                  </div>
                </div>

                {dealHealth.anomalies?.length > 0 && (
                  <div className="mb-6 bg-coral/5 border border-coral/20 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-coral mb-3 flex items-center gap-2">
                      <TrendingUp size={16} /> Discount Anomalies
                    </h3>
                    <div className="space-y-3">
                      {dealHealth.anomalies.map((a: any) => (
                        <div key={a.id} className="flex justify-between items-center text-sm bg-white p-3 rounded border border-coral/10">
                          <div>
                            <span className="font-semibold text-ink">{a.customerName}</span>
                            <span className="text-subtle ml-2">({a.quotationNumber})</span>
                            <span className="text-subtle ml-2">— Rep: {a.salesRepName}</span>
                          </div>
                          <div className="flex gap-4">
                            <span className="text-subtle">Rep Avg: {Number(a.repAvg).toFixed(1)}%</span>
                            <span className="text-coral font-medium">Current: {Number(a.currentDiscount).toFixed(1)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Approval Queue Section */}
            <div>
              <h2 className="text-lg font-semibold text-ink mb-4">Approval Queue</h2>
              {queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-soft border border-hairline rounded-xl">
                  <div className="w-16 h-16 rounded-lg bg-success/10 border border-success/30 flex items-center justify-center mb-4">
                    <CheckSquare size={28} className="text-success" />
                  </div>
                  <h2 className="text-lg font-semibold text-ink">Queue is clear</h2>
                  <p className="text-subtle text-sm mt-2 max-w-sm">
                    No quotations are waiting for your approval right now.
                  </p>
                </div>
              ) : (
                <>
                  <ApprovalQueue
                    items={queue}
                    onReview={(id) => setSelectedId(id)}
                  />
                  {!loading && queue.length > 0 && (
                    <div className="mt-6">
                      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={load} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedId && (
        <ApprovalReviewDrawer
          quotationId={selectedId}
          approverRole="SALES_MANAGER"
          onClose={() => setSelectedId(null)}
          onDecision={handleDecision}
        />
      )}
    </AppShell>
  );
}
