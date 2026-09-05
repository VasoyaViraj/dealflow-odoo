import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import ApprovalQueue from '../components/approvals/ApprovalQueue';
import ApprovalReviewDrawer from '../components/approvals/ApprovalReviewDrawer';
import { CheckSquare, RefreshCw } from 'lucide-react';
import api from '../lib/api';

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
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/approval-queue');
      setQueue(r.data.data);
    } catch {
      // handled by api interceptor
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  const handleDecision = () => {
    setSelectedId(null);
    load();
  };

  return (
    <AppShell>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Approval Queue</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Quotations pending your review.{' '}
              <span className="text-emerald-400 font-medium">{queue.length} in queue</span>
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

        {loading ? (
          <div className="flex items-center justify-center py-32 text-zinc-500">
            <RefreshCw size={20} className="animate-spin mr-3" />
            Loading queue…
          </div>
        ) : queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <CheckSquare size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-200">Queue is clear</h2>
            <p className="text-zinc-500 text-sm mt-2 max-w-sm">
              No quotations are waiting for your approval right now.
            </p>
          </div>
        ) : (
          <ApprovalQueue
            items={queue}
            onReview={(id) => setSelectedId(id)}
          />
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
