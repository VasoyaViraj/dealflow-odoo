import { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Clock, Check, X, ArrowLeftCircle, AlertCircle } from 'lucide-react';
import api from '../../lib/api';

interface RiskResult {
  totalRiskScore: number;
  factors: Array<{ factor: string; score: number }>;
}

interface ApprovalHistoryItem {
  id: string;
  level: string;
  status: string;
  reason?: string;
  approver?: { firstName: string; lastName: string };
  createdAt: string;
}

interface Props {
  quotationId: string;
  currentStatus: string;
  isManagerView: boolean;
  onStatusChanged: () => void;
}

export default function ApprovalWorkflowPanel({ quotationId, currentStatus, isManagerView, onStatusChanged }: Props) {
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [actionReason, setActionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        // Only load risk/history if it's past the draft stage, though risk is calculable anytime
        const [riskRes, histRes] = await Promise.all([
          api.get(`/quotations/${quotationId}/risk`),
          api.get(`/quotations/${quotationId}/approvals`)
        ]);
        if (mounted) {
          setRisk(riskRes.data.data);
          setHistory(histRes.data.data);
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [quotationId, currentStatus]);

  const handleAction = async (action: 'approve' | 'reject' | 'request-revision') => {
    if ((action === 'reject' || action === 'request-revision') && !actionReason.trim()) {
      setError(`Reason is required to ${action.replace('-', ' ')}`);
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      await api.post(`/quotations/${quotationId}/${action}`, { reason: actionReason });
      setActionReason('');
      onStatusChanged();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPendingForMe = isManagerView && (currentStatus === 'PENDING_MANAGER' || currentStatus === 'PENDING_FINANCE');

  if (loading) {
    return <div className="animate-pulse bg-zinc-900 h-64 rounded-xl border border-zinc-800"></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Risk Panel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            {risk?.totalRiskScore && risk.totalRiskScore > 0 ? (
              <ShieldAlert className="text-amber-400" size={18} />
            ) : (
              <ShieldCheck className="text-emerald-400" size={18} />
            )}
            Risk Assessment
          </h3>
          <span className="text-sm font-medium px-2 py-1 bg-zinc-800 rounded-lg text-zinc-300">
            Score: <span className={risk?.totalRiskScore && risk.totalRiskScore > 5 ? 'text-red-400' : 'text-emerald-400'}>{risk?.totalRiskScore || 0}</span>
          </span>
        </div>
        
        {risk?.factors && risk.factors.length > 0 ? (
          <ul className="space-y-2 text-sm text-zinc-400">
            {risk.factors.map((f, i) => (
              <li key={i} className="flex justify-between items-center bg-zinc-950/50 p-2 rounded">
                <span>{f.factor}</span>
                <span className="font-mono text-xs font-semibold text-amber-400">+{f.score}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No risk factors identified. Routine deal.</p>
        )}
      </div>

      {/* Approval Actions (If Pending) */}
      {isPendingForMe && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="font-semibold text-white mb-4">Your Decision</h3>
          
          <textarea
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder="Reason (Required for Rejection/Revision)"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 mb-4 h-24 resize-none"
          />
          
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-4 bg-red-500/10 p-2 rounded border border-red-500/20">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleAction('approve')}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 py-2 rounded-lg text-sm font-medium transition-all"
            >
              <Check size={16} /> Approve
            </button>
            <button
              onClick={() => handleAction('request-revision')}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30 py-2 rounded-lg text-sm font-medium transition-all"
            >
              <ArrowLeftCircle size={16} /> Request Rev
            </button>
            <button
              onClick={() => handleAction('reject')}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 py-2 rounded-lg text-sm font-medium transition-all"
            >
              <X size={16} /> Reject
            </button>
          </div>
        </div>
      )}

      {/* History Panel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex-1">
        <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
          <Clock size={18} className="text-zinc-400" />
          Approval History
        </h3>
        
        {history.length > 0 ? (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="relative pl-6 border-l-2 border-zinc-800 last:border-transparent pb-4">
                <div className="absolute w-3 h-3 bg-zinc-700 rounded-full -left-[7px] top-1.5 border-2 border-zinc-900"></div>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-medium text-zinc-200">
                    {item.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-zinc-400">By {item.approver?.firstName} {item.approver?.lastName} ({item.level.replace('_', ' ')})</p>
                {item.reason && (
                  <p className="text-sm text-zinc-300 mt-2 bg-zinc-800 p-2 rounded italic">"{item.reason}"</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No approval history yet.</p>
        )}
      </div>
    </div>
  );
}
