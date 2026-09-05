import { useState, useEffect, useCallback } from 'react';
import AppShell from '../components/layout/AppShell';
import ApprovalQueue from '../components/approvals/ApprovalQueue';
import ApprovalReviewDrawer from '../components/approvals/ApprovalReviewDrawer';
import { DollarSign, RefreshCw, ShieldAlert } from 'lucide-react';
import api from '../lib/api';
import type { QueueItem } from './ManagerDashboard';

export default function FinanceDashboard() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/approval-queue');
      setQueue(r.data.data);
    } catch {
      // handled by interceptor
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
            <h1 className="text-2xl font-bold text-white">Finance Approvals</h1>
            <p className="text-zinc-400 text-sm mt-1">
              High-risk deals requiring finance sign-off.{' '}
              <span className="text-amber-400 font-medium">{queue.length} pending</span>
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

        {/* Finance-specific callout */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 flex items-start gap-3 mb-6">
          <ShieldAlert size={18} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-300">High-Risk Deals Only</p>
            <p className="text-xs text-amber-400/80 mt-1">
              Deals appear here only after Sales Manager approval when the risk score requires Finance sign-off.
              Every action you take is permanently recorded in the audit trail.
            </p>
          </div>
        </div>

        {loading ? (
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
      </div>

      {selectedId && (
        <ApprovalReviewDrawer
          quotationId={selectedId}
          approverRole="FINANCE_OPERATIONS"
          onClose={() => setSelectedId(null)}
          onDecision={handleDecision}
        />
      )}
    </AppShell>
  );
}
