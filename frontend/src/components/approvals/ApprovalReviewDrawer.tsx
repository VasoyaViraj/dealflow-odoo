import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import {
  X, AlertTriangle, CheckCircle, XCircle, RotateCcw,
  Shield, FileText, Clock, User, TrendingDown
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Violation {
  lineId: string;
  productName: string;
  productCategory: string;
  actualDiscount: number;
  allowedDiscount: number;
  deviation: number;
}

interface RiskData {
  riskScore: number;
  approvalRequired: boolean;
  requiredLevel: 'NONE' | 'SALES_MANAGER' | 'FINANCE';
  violations: Violation[];
}

interface ApprovalHistoryEntry {
  id: string;
  approverId: string;
  approvalLevel: string;
  decision: string;
  reason: string | null;
  createdAt: string;
}

interface ApprovalStatus {
  quotationId: string;
  currentStatus: string;
  riskScore: string | null;
  approvalLevel: string | null;
  history: ApprovalHistoryEntry[];
}

interface QuotationSummary {
  id: string;
  quotationNumber: string;
  customerName?: string;
  grandTotal: string;
  status: string;
  riskScore: string;
  approvalLevel: string;
  lines?: Array<{
    id: string;
    productName: string;
    category: string;
    quantity: number;
    discountPercent: string;
    lineTotal: string;
  }>;
}

interface Props {
  quotationId: string;
  approverRole: 'SALES_MANAGER' | 'FINANCE_OPERATIONS';
  onClose: () => void;
  onDecision: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RiskMeter({ score }: { score: number }) {
  const pct = Math.min(100, (score / 100) * 100);
  const color = score >= 50 ? '#aa2d00' : score >= 10 ? '#d9a441' : '#006400';
  const label = score >= 50 ? 'HIGH' : score >= 10 ? 'MEDIUM' : 'LOW';
  const labelColor = score >= 50 ? 'text-coral' : score >= 10 ? 'text-warning' : 'text-success';

  return (
    <div className="bg-soft border border-hairline rounded-md p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-body">Blended Risk Score</span>
        <span className={`text-2xl font-bold ${labelColor}`}>{score.toFixed(1)}</span>
      </div>
      <div className="w-full h-2 bg-strong rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-subtle">0</span>
        <span className={`text-xs font-bold ${labelColor}`}>{label} RISK</span>
        <span className="text-xs text-subtle">100</span>
      </div>
    </div>
  );
}

function ApprovalChain({ currentStatus, requiredLevel }: { currentStatus: string; requiredLevel: string | null }) {
  const managerDone = ['PENDING_FINANCE', 'APPROVED', 'REJECTED'].includes(currentStatus);
  const managerActive = currentStatus === 'PENDING_MANAGER';
  const financeActive = currentStatus === 'PENDING_FINANCE';
  const financeDone = currentStatus === 'APPROVED' && requiredLevel === 'FINANCE';

  const needsFinance = requiredLevel === 'FINANCE';

  return (
    <div className="bg-soft border border-hairline rounded-md p-5">
      <p className="text-sm font-medium text-body mb-4">Approval Chain</p>
      <div className="flex items-center gap-3">
        {/* Sales Manager node */}
        <div className="flex flex-col items-center gap-1.5">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
 managerDone ? 'bg-success/10 border-success text-success' :
 managerActive ? 'bg-cream border-ink text-ink ring-4 ring-ink/15' :
 'bg-strong border-hairline text-subtle'
 }`}>
            {managerDone ? <CheckCircle size={16} /> : <User size={16} />}
          </div>
          <span className="text-xs text-subtle text-center leading-tight">Sales<br />Manager</span>
        </div>

        {/* Connector */}
        <div className={`flex-1 h-0.5 ${managerDone && needsFinance ? 'bg-success' : 'bg-strong'}`} />

        {/* Finance node */}
        <div className={`flex flex-col items-center gap-1.5 ${!needsFinance ? 'opacity-30' : ''}`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
 financeDone ? 'bg-success/10 border-success text-success' :
 financeActive ? 'bg-mustard/20 border-mustard text-warning ring-4 ring-warning/20' :
 'bg-strong border-hairline text-subtle'
 }`}>
            {financeDone ? <CheckCircle size={16} /> : <Shield size={16} />}
          </div>
          <span className="text-xs text-subtle text-center leading-tight">Finance<br />{needsFinance ? '' : '(not req.)'}</span>
        </div>

        {/* Final approved node */}
        <div className={`flex-1 h-0.5 ${currentStatus === 'APPROVED' ? 'bg-success' : 'bg-strong'}`} />
        <div className="flex flex-col items-center gap-1.5">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
 currentStatus === 'APPROVED' ? 'bg-success/10 border-success text-success' :
 'bg-strong border-hairline text-subtle'
 }`}>
            <CheckCircle size={16} />
          </div>
          <span className="text-xs text-subtle text-center leading-tight">Fully<br />Approved</span>
        </div>
      </div>
    </div>
  );
}

function ViolationList({ violations }: { violations: Violation[] }) {
  if (violations.length === 0) {
    return (
      <div className="bg-success/10 border border-success/30 rounded-md px-4 py-3 flex items-center gap-3">
        <CheckCircle size={16} className="text-success shrink-0" />
        <p className="text-sm text-success">No discount violations — all lines within limits.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-subtle flex items-center gap-2">
        <AlertTriangle size={14} className="text-coral" />
        {violations.length} Violation{violations.length > 1 ? 's' : ''} Detected
      </p>
      {violations.map((v) => (
        <div key={v.lineId} className="bg-coral/8 border border-coral/30 rounded-md px-4 py-3.5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-ink text-sm">{v.productName}</p>
              <span className="text-xs text-subtle">{v.productCategory}</span>
            </div>
            <span className="text-xs font-bold text-coral bg-coral/8 px-2 py-0.5 rounded-full border border-coral/30">
              +{v.deviation.toFixed(1)}% over limit
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-coral/30">
            <div>
              <p className="text-xs text-subtle mb-0.5">Allowed (lower of tier / category)</p>
              <p className="text-sm font-semibold text-success">{v.allowedDiscount.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-subtle mb-0.5">Actual Applied</p>
              <p className="text-sm font-semibold text-coral">{v.actualDiscount.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditHistory({ history }: { history: ApprovalHistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="text-xs text-subtle text-center py-4">No approval actions yet.</p>;
  }

  const decisionStyle: Record<string, string> = {
    APPROVED: 'text-success',
    REJECTED: 'text-coral',
    REVISION_REQUESTED: 'text-warning',
  };

  const decisionIcon: Record<string, React.ReactNode> = {
    APPROVED: <CheckCircle size={14} className="text-success" />,
    REJECTED: <XCircle size={14} className="text-coral" />,
    REVISION_REQUESTED: <RotateCcw size={14} className="text-warning" />,
  };

  return (
    <div className="space-y-3">
      {history.map((h) => (
        <div key={h.id} className="flex gap-3">
          <div className="mt-0.5 shrink-0">{decisionIcon[h.decision] ?? <Clock size={14} className="text-subtle" />}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-semibold ${decisionStyle[h.decision] ?? 'text-body'}`}>
                {h.decision.replace('_', ' ')}
              </span>
              <span className="text-xs text-subtle">by {h.approvalLevel.replace('_', ' ')}</span>
              <span className="text-xs text-line-strong">· {fmtDate(h.createdAt)}</span>
            </div>
            {h.reason && (
              <p className="text-xs text-subtle mt-1 italic">"{h.reason}"</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export default function ApprovalReviewDrawer({ quotationId, approverRole, onClose, onDecision }: Props) {
  const [quotation, setQuotation] = useState<QuotationSummary | null>(null);
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Action state
  const [action, setAction] = useState<'approve' | 'reject' | 'revise' | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [qRes, rRes, aRes] = await Promise.all([
        api.get(`/quotations/${quotationId}`),
        api.get(`/quotations/${quotationId}/risk`),
        api.get(`/quotations/${quotationId}/approvals`),
      ]);
      setQuotation(qRes.data.data);
      setRisk(rRes.data.data);
      setApprovalStatus(aRes.data.data);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to load quotation');
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!action) return;
    if ((action === 'reject' || action === 'revise') && !reason.trim()) {
      setActionError('A reason is required for this action.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    try {
      const endpoint = action === 'approve'
        ? `/quotations/${quotationId}/approve`
        : action === 'reject'
        ? `/quotations/${quotationId}/reject`
        : `/quotations/${quotationId}/request-revision`;

      await api.post(endpoint, { reason: reason.trim() || undefined });
      onDecision();
    } catch (e: any) {
      setActionError(e?.response?.data?.error ?? 'Action failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentStatus = approvalStatus?.currentStatus ?? quotation?.status ?? '';
  const canAct = (approverRole === 'SALES_MANAGER' && currentStatus === 'PENDING_MANAGER') ||
                 (approverRole === 'FINANCE_OPERATIONS' && currentStatus === 'PENDING_FINANCE');

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-soft border-l border-hairline shadow-lg z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline shrink-0">
          <div>
            <p className="text-xs text-subtle font-medium uppercase tracking-wider">Quotation Review</p>
            <h2 className="text-lg font-bold text-ink mt-0.5">
              {quotation?.quotationNumber ?? '…'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-subtle hover:text-ink hover:bg-soft rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-subtle gap-3">
            <div className="w-5 h-5 border-2 border-hairline border-t-ink rounded-full animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <AlertTriangle size={32} className="text-coral mb-3" />
            <p className="text-body font-medium">{error}</p>
            <button onClick={load} className="mt-4 text-sm text-link hover:text-link-active">Try again</button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-0 border-b border-hairline">
              <div className="px-6 py-4 border-r border-hairline">
                <p className="text-xs text-subtle">Customer</p>
                <p className="text-sm font-semibold text-ink mt-1">{quotation?.customerName ?? '—'}</p>
              </div>
              <div className="px-6 py-4 border-r border-hairline">
                <p className="text-xs text-subtle">Grand Total</p>
                <p className="text-sm font-bold text-ink mt-1">{fmt(quotation?.grandTotal ?? 0)}</p>
              </div>
              <div className="px-6 py-4">
                <p className="text-xs text-subtle">Status</p>
                <p className="text-sm font-semibold text-ink mt-1">{currentStatus.replace('_', ' ')}</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Risk Meter */}
              {risk && <RiskMeter score={risk.riskScore} />}

              {/* Violations */}
              {risk && <ViolationList violations={risk.violations} />}

              {/* Quotation Lines Summary */}
              {quotation?.lines && quotation.lines.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-subtle mb-3 flex items-center gap-2">
                    <FileText size={14} />
                    Quotation Lines
                  </p>
                  <div className="space-y-2">
                    {quotation.lines.map((line) => (
                      <div key={line.id} className="bg-soft border border-hairline rounded-lg px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-ink">{line.productName}</p>
                          <p className="text-xs text-subtle mt-0.5">Qty {line.quantity} · Disc {parseFloat(line.discountPercent).toFixed(1)}%</p>
                        </div>
                        <p className="text-sm font-semibold text-ink">{fmt(line.lineTotal)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approval Chain */}
              {approvalStatus && (
                <ApprovalChain
                  currentStatus={currentStatus}
                  requiredLevel={approvalStatus.approvalLevel}
                />
              )}

              {/* Audit History */}
              {approvalStatus && approvalStatus.history.length > 0 && (
                <div className="bg-soft border border-hairline rounded-md p-5">
                  <p className="text-sm font-medium text-body mb-4 flex items-center gap-2">
                    <Clock size={14} />
                    Approval History
                  </p>
                  <AuditHistory history={approvalStatus.history} />
                </div>
              )}

              {/* Action Section */}
              {canAct && (
                <div className="bg-canvas border border-hairline rounded-md p-5">
                  <p className="text-sm font-semibold text-ink mb-4">Your Decision</p>

                  {/* Action picker */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <button
                      id="action-approve"
                      onClick={() => { setAction('approve'); setReason(''); setActionError(''); }}
                      className={`flex flex-col items-center gap-2 py-3.5 rounded-md border transition-all ${
 action === 'approve'
 ? 'bg-success/10 border-success text-success'
 : 'bg-soft border-hairline text-subtle hover:border-success hover:text-success'
 }`}
                    >
                      <CheckCircle size={20} />
                      <span className="text-xs font-semibold">Approve</span>
                    </button>

                    <button
                      id="action-reject"
                      onClick={() => { setAction('reject'); setActionError(''); }}
                      className={`flex flex-col items-center gap-2 py-3.5 rounded-md border transition-all ${
 action === 'reject'
 ? 'bg-coral/8 border-coral text-coral'
 : 'bg-soft border-hairline text-subtle hover:border-coral hover:text-coral'
 }`}
                    >
                      <XCircle size={20} />
                      <span className="text-xs font-semibold">Reject</span>
                    </button>

                    <button
                      id="action-revise"
                      onClick={() => { setAction('revise'); setActionError(''); }}
                      className={`flex flex-col items-center gap-2 py-3.5 rounded-md border transition-all ${
 action === 'revise'
 ? 'bg-mustard/20 border-mustard text-warning'
 : 'bg-soft border-hairline text-subtle hover:border-mustard hover:text-warning'
 }`}
                    >
                      <RotateCcw size={20} />
                      <span className="text-xs font-semibold">Return</span>
                    </button>
                  </div>

                  {/* Reason input */}
                  {action && (
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-subtle mb-1.5">
                        Reason {action === 'approve' ? '(optional)' : '(required)'}
                      </label>
                      <textarea
                        id="approval-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={
                          action === 'approve'
                            ? 'Optional note for audit trail…'
                            : action === 'reject'
                            ? 'Explain why this quotation is rejected…'
                            : 'Explain what needs to be revised…'
                        }
                        rows={3}
                        className="w-full bg-soft border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink placeholder-line-strong focus:outline-none focus:border-ink resize-none"
                      />
                    </div>
                  )}

                  {actionError && (
                    <div className="flex items-center gap-2 bg-coral/8 border border-coral/30 rounded-lg px-3 py-2.5 mb-4 text-sm text-coral">
                      <AlertTriangle size={14} className="shrink-0" />
                      {actionError}
                    </div>
                  )}

                  {action && (
                    <button
                      id="confirm-decision"
                      onClick={submit}
                      disabled={submitting}
                      className={`w-full py-3 rounded-md font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
 action === 'approve'
 ? 'bg-success /90 text-white'
 : action === 'reject'
 ? 'bg-coral /90 text-white'
 : 'bg-mustard /90 text-ink'
 }`}
                    >
                      {submitting ? 'Processing…' : (
                        action === 'approve' ? 'Confirm Approval' :
                        action === 'reject'  ? 'Confirm Rejection' :
                        'Return for Revision'
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Already actioned message */}
              {!canAct && !loading && (
                <div className="bg-soft border border-hairline rounded-md px-5 py-4 flex items-center gap-3">
                  <TrendingDown size={16} className="text-subtle shrink-0" />
                  <p className="text-sm text-subtle">
                    {currentStatus === 'APPROVED'
                      ? 'This quotation is fully approved.'
                      : currentStatus === 'REJECTED'
                      ? 'This quotation has been rejected.'
                      : currentStatus === 'REVISION_REQUESTED'
                      ? 'Returned to sales rep for revision.'
                      : `No action available in current status: ${currentStatus}`}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
