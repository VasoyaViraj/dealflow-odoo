import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '../components/layout/AppShell';
import {
  Plus, ArrowLeft, ShoppingCart, Package, RefreshCw,
  Trash2, AlertTriangle, CheckCircle, ChevronRight,
  Search, Send, X, Star, Info,
  FileText, Minus, Clock
} from 'lucide-react';
import api from '../lib/api';
import { getProducts, getSubscriptionPlans } from '../lib/referenceData';
import FulfillmentPanel from '../components/fulfillment/FulfillmentPanel';
import { BillingOverview } from '../components/billing/BillingOverview';
import type { SubscriptionPlan } from '../types/billing';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer { id: string; name: string; email: string; tier: string; }

interface Product {
  id: string; name: string; sku: string | null;
  category: string; unitPrice: string; description: string | null;
}

interface QuotationLine {
  id: string; lineNumber: number; productId: string; productName: string;
  productSku: string | null; category: string; quantity: number;
  unitPrice: string; discountPercent: string;
  grossAmount: string; discountAmount: string; lineTotal: string;
  margin: string; marginPercent: string;
  maxDiscountPercent: string; isOverDiscountLimit: boolean;
}

interface Quotation {
  id: string; quotationNumber: string; status: string; notes: string | null;
  customerId: string;
  customer: { id: string; name: string; email: string; tier: string };
  salesRepId: string;
  quotationDiscountPercent: string;
  subtotal: string; lineDiscountAmount?: string;
  quotationDiscountAmount?: string; discountAmount: string;
  taxableAmount?: string; taxAmount: string; grandTotal: string;
  margin: string; marginPercent: string;
  blendedRiskScore: string; requiresApproval: boolean;
  requiredApprovalLevel: string | null;
  version: number; createdAt: string; updatedAt: string;
  lines: QuotationLine[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor(diff / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h >= 1) return `${h}h ago`;
  if (m >= 1) return `${m}m ago`;
  return 'just now';
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', SUBMITTED: 'Submitted',
  PENDING_MANAGER: 'Awaiting Manager', PENDING_FINANCE: 'Awaiting Finance',
  APPROVED: 'Approved', REJECTED: 'Rejected',
  CANCELLED: 'Cancelled', EXPIRED: 'Expired',
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-zinc-700 text-zinc-300 border-zinc-600',
    SUBMITTED: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    PENDING_MANAGER: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    PENDING_FINANCE: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    APPROVED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    REJECTED: 'bg-red-500/15 text-red-300 border-red-500/30',
  };
  return (
    <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full border ${colors[status] ?? 'bg-zinc-700 text-zinc-300'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function CategoryBadge({ cat }: { cat: string }) {
  const colors: Record<string, string> = {
    HARDWARE: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    SERVICES: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    SUBSCRIPTION: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  };
  return (
    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${colors[cat] ?? 'bg-zinc-700 text-zinc-400'}`}>
      {cat}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    GOLD: 'text-amber-400', SILVER: 'text-zinc-400', BRONZE: 'text-orange-400',
  };
  return <span className={`text-xs font-bold uppercase ${colors[tier] ?? ''}`}>{tier}</span>;
}

function MarginBar({ pct }: { pct: number }) {
  const color = pct >= 30 ? '#10b981' : pct >= 15 ? '#f59e0b' : '#ef4444';
  const label = pct >= 30 ? 'Healthy' : pct >= 15 ? 'Slim' : 'Low';
  const labelColor = pct >= 30 ? 'text-emerald-400' : pct >= 15 ? 'text-amber-400' : 'text-red-400';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-500">Margin</span>
        <span className={`font-bold ${labelColor}`}>{pct.toFixed(1)}% · {label}</span>
      </div>
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct * 2, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function RiskBadge({ score }: { score: string }) {
  const n = parseFloat(score);
  if (n >= 50) return <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-full"><AlertTriangle size={10} />High Risk</span>;
  if (n >= 10) return <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full"><AlertTriangle size={10} />Med Risk</span>;
  return null;
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium border
      ${type === 'success' ? 'bg-emerald-900/80 text-emerald-300 border-emerald-500/30' : 'bg-red-900/80 text-red-300 border-red-500/30'}`}>
      {type === 'success' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
      {msg}
    </div>
  );
}

// ─── Create Quotation Modal ────────────────────────────────────────────────────

function CreateQuotationModal({
  onClose, onCreated, showToast,
}: {
  onClose: () => void;
  onCreated: (q: Quotation) => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.get('/customers').then(r => setCustomers(r.data.data)).finally(() => setFetching(false));
  }, []);

  const create = async () => {
    if (!customerId) { showToast('Select a customer', 'error'); return; }
    setLoading(true);
    try {
      const r = await api.post('/quotations', { customerId, notes: notes.trim() || undefined });
      onCreated(r.data.data);
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? e?.response?.data?.error ?? 'Failed to create quotation', 'error');
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">New Quotation</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition"><X size={18} /></button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5 font-medium">Customer *</label>
              {fetching ? (
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-500">Loading customers…</div>
              ) : (
                <select
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 transition"
                >
                  <option value="">— Select a customer —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.tier})</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5 font-medium">Notes <span className="text-zinc-600">(optional)</span></label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Internal notes for this quotation…"
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 resize-none transition"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 transition">Cancel</button>
            <button
              id="create-quotation-submit"
              onClick={create}
              disabled={loading || !customerId}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : 'Create Quotation'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Quotation List View ───────────────────────────────────────────────────────

function QuotationListView({
  quotations, loading, onOpen, onNew, onRefresh,
}: {
  quotations: Quotation[];
  loading: boolean;
  onOpen: (q: Quotation) => void;
  onNew: () => void;
  onRefresh: () => void;
}) {
  const pending = quotations.filter(q => ['PENDING_MANAGER', 'PENDING_FINANCE'].includes(q.status)).length;
  const approved = quotations.filter(q => q.status === 'APPROVED').length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Workspace</h1>
          <p className="text-zinc-400 text-sm mt-1">Create and manage your quotations.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded-lg text-sm transition">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            id="new-quotation-btn"
            onClick={onNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-violet-500/20 transition"
          >
            <Plus size={15} /> New Quotation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Quotations', value: quotations.length, icon: <FileText size={18} />, color: 'text-zinc-300' },
          { label: 'Pending Approval', value: pending, icon: <Clock size={18} />, color: 'text-amber-400' },
          { label: 'Approved', value: approved, icon: <CheckCircle size={18} />, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 flex items-center gap-4">
            <div className={`${s.color} opacity-60`}>{s.icon}</div>
            <div>
              <p className="text-xs text-zinc-500 font-medium">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quotation Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-32 text-zinc-500">
          <RefreshCw size={20} className="animate-spin mr-3" /> Loading quotations…
        </div>
      ) : quotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
            <ShoppingCart size={28} className="text-violet-400" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-200">No quotations yet</h2>
          <p className="text-zinc-500 text-sm mt-2 max-w-sm">Create your first quotation to start building deals.</p>
          <button onClick={onNew} className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition">
            <Plus size={15} /> New Quotation
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {quotations.map(q => (
            <div
              key={q.id}
              id={`quotation-card-${q.id}`}
              onClick={() => onOpen(q)}
              className="bg-zinc-900 border border-zinc-800 hover:border-violet-500/40 hover:bg-violet-500/5 rounded-2xl p-5 flex flex-col gap-3 cursor-pointer transition-all duration-200 group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-mono">{q.quotationNumber}</p>
                  <p className="font-semibold text-white text-base mt-0.5">{q.customer?.name ?? '—'}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{q.customer && <TierBadge tier={q.customer.tier} />}</p>
                </div>
                <ChevronRight size={18} className="text-zinc-600 group-hover:text-zinc-300 transition mt-1" />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={q.status} />
                {parseFloat(q.blendedRiskScore) > 0 && <RiskBadge score={q.blendedRiskScore} />}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/60 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-zinc-500 mb-0.5">Grand Total</p>
                  <p className="text-sm font-bold text-white">{fmt(q.grandTotal)}</p>
                </div>
                <div className="bg-zinc-800/60 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-zinc-500 mb-0.5">Lines</p>
                  <p className="text-sm font-bold text-zinc-200">{q.lines?.length ?? '—'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-zinc-800 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><Clock size={11} /> {timeAgo(q.updatedAt)}</span>
                <span className="text-violet-400 font-medium group-hover:text-violet-300 transition">Open →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Quotation Builder View ────────────────────────────────────────────────────

function QuotationBuilderView({
  initialQuotation, onBack, showToast,
}: {
  initialQuotation: Quotation;
  onBack: () => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [q, setQ] = useState<Quotation>(initialQuotation);
  const [products, setProducts] = useState<Product[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [catFilter, setCatFilter] = useState<'ALL' | 'HARDWARE' | 'SERVICES' | 'SUBSCRIPTION'>('ALL');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);  // productId being added
  const [lineUpdating, setLineUpdating] = useState<string | null>(null); // lineId being updated
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [planSelectProduct, setPlanSelectProduct] = useState<Product | null>(null);
  const [notes, setNotes] = useState(initialQuotation.notes ?? '');
  const [orderDiscount, setOrderDiscount] = useState(initialQuotation.quotationDiscountPercent ?? '0');
  const [sidebarTab, setSidebarTab] = useState<'summary' | 'billing'>('summary');
  const notesTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isEditable = q.status === 'DRAFT';

  useEffect(() => {
    getProducts().then(setProducts);
    getSubscriptionPlans().then(setSubscriptionPlans).catch(() => {});
  }, []);

  // ─ Product Catalogue helpers

  const filteredProducts = products.filter(p => {
    const matchCat = catFilter === 'ALL' || p.category === catFilter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const addedProductIds = new Set(q.lines.map(l => l.productId));

  // Upsell suggestions: products not in cart, prefer different categories
  const cartCategories = new Set(q.lines.map(l => l.category));
  const upsellSuggestions = products
    .filter(p => !addedProductIds.has(p.id))
    .sort((a, b) => {
      const aNew = !cartCategories.has(a.category) ? -1 : 1;
      const bNew = !cartCategories.has(b.category) ? -1 : 1;
      return aNew - bNew;
    })
    .slice(0, 3);

  // ─ Mutations

  const addProduct = async (productId: string, subscriptionPlanId?: string) => {
    if (!isEditable) return;
    
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (product.category === 'SUBSCRIPTION' && !subscriptionPlanId) {
      setPlanSelectProduct(product);
      return;
    }

    setAdding(productId);
    try {
      const r = await api.post(`/quotations/${q.id}/items`, { productId, quantity: 1, expectedVersion: q.version, subscriptionPlanId });
      setQ(r.data.data);
      showToast('Product added');
      setPlanSelectProduct(null);
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? 'Failed to add product', 'error');
    } finally { setAdding(null); }
  };

  const updateLineQty = async (lineId: string, delta: number, current: number) => {
    if (!isEditable) return;
    const newQty = current + delta;
    if (newQty < 1) return;
    setLineUpdating(lineId);
    try {
      const r = await api.patch(`/quotations/${q.id}/items/${lineId}`, { quantity: newQty, expectedVersion: q.version });
      setQ(r.data.data);
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? 'Update failed', 'error');
    } finally { setLineUpdating(null); }
  };

  const updateLineDiscount = async (lineId: string, discountPercent: number) => {
    if (!isEditable) return;
    setLineUpdating(lineId);
    try {
      const r = await api.patch(`/quotations/${q.id}/items/${lineId}`, { discountPercent, expectedVersion: q.version });
      setQ(r.data.data);
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? 'Update failed', 'error');
    } finally { setLineUpdating(null); }
  };

  const removeLine = async (lineId: string) => {
    if (!isEditable) return;
    setLineUpdating(lineId);
    try {
      const r = await api.delete(`/quotations/${q.id}/items/${lineId}?expectedVersion=${q.version}`);
      setQ(r.data.data);
      showToast('Line removed');
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? 'Remove failed', 'error');
    } finally { setLineUpdating(null); }
  };

  const saveNotesAndDiscount = useCallback(async (notesVal: string, discountVal: string) => {
    if (!isEditable) return;
    try {
      const r = await api.patch(`/quotations/${q.id}`, {
        notes: notesVal.trim() || null,
        quotationDiscountPercent: parseFloat(discountVal) || 0,
        expectedVersion: q.version,
      });
      setQ(r.data.data);
    } catch { /* silently fail on auto-save */ }
  }, [q.id, q.version, isEditable]);

  const handleNotesChange = (v: string) => {
    setNotes(v);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => saveNotesAndDiscount(v, orderDiscount), 1000);
  };

  const handleDiscountBlur = () => saveNotesAndDiscount(notes, orderDiscount);

  const submitQuotation = async () => {
    if (q.lines.length === 0) { showToast('Add at least one product before submitting', 'error'); return; }
    setSubmitting(true);
    try {
      const r = await api.post(`/quotations/${q.id}/submit`, { expectedVersion: q.version });
      setQ(r.data.data);
      setSubmitted(true);
      showToast('Quotation submitted for approval');
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? 'Submit failed', 'error');
    } finally { setSubmitting(false); }
  };

  const marginPct = parseFloat(q.marginPercent) || 0;
  const riskScore = parseFloat(q.blendedRiskScore) || 0;

  return (
    <div className="flex flex-col h-full">
      {/* Builder header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-zinc-800 shrink-0 bg-zinc-950">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="w-px h-5 bg-zinc-800" />
          <div>
            <span className="text-xs text-zinc-500 font-mono">{q.quotationNumber}</span>
            <h1 className="text-base font-bold text-white leading-none mt-0.5">{q.customer?.name}</h1>
          </div>
          <StatusBadge status={q.status} />
          {riskScore >= 10 && <RiskBadge score={q.blendedRiskScore} />}
        </div>
        {isEditable && !submitted && (
          <button
            id="submit-quotation-btn"
            onClick={submitQuotation}
            disabled={submitting || q.lines.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-violet-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} /> {submitting ? 'Submitting…' : 'Submit for Approval'}
          </button>
        )}
        {!isEditable && (
          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Info size={13} /> Read-only — quotation submitted
          </div>
        )}
      </div>

      {/* Submitted banner */}
      {submitted && (
        <div className={`mx-8 mt-4 flex items-center gap-3 px-5 py-4 rounded-xl border text-sm font-medium
          ${q.requiresApproval
            ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
          <CheckCircle size={18} className="shrink-0" />
          <div>
            <p className="font-semibold">{q.requiresApproval ? 'Pending Approval' : 'Auto-Approved — no approval needed'}</p>
            {q.requiresApproval && (
              <p className="text-xs opacity-70 mt-0.5">
                Routed to {q.requiredApprovalLevel === 'FINANCE' ? 'Sales Manager → Finance' : 'Sales Manager'} · Risk score {riskScore.toFixed(1)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Catalog + Lines */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Product Catalog */}
          {isEditable && (
            <div className="border-b border-zinc-800 px-8 py-5 bg-zinc-950/60">
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                <Package size={12} /> Product Catalogue — Click to add
              </p>
              {/* Category tabs + search */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                  {(['ALL', 'HARDWARE', 'SERVICES', 'SUBSCRIPTION'] as const).map(c => (
                    <button
                      key={c}
                      id={`cat-tab-${c.toLowerCase()}`}
                      onClick={() => setCatFilter(c)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${catFilter === c ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 max-w-xs">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search products…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition"
                  />
                </div>
              </div>

              {/* Product grid */}
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                {filteredProducts.map(p => {
                  const inCart = addedProductIds.has(p.id);
                  const isAdding = adding === p.id;
                  return (
                    <button
                      key={p.id}
                      id={`add-product-${p.id}`}
                      onClick={() => !inCart && addProduct(p.id)}
                      disabled={inCart || !!adding}
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-all text-sm ${
                        inCart
                          ? 'bg-zinc-800/50 border-zinc-700/50 cursor-default opacity-50'
                          : 'bg-zinc-800 border-zinc-700 hover:border-violet-500/50 hover:bg-violet-500/10 cursor-pointer'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-100 truncate text-xs">{p.name}</p>
                        <p className="text-zinc-500 text-xs">{fmt(p.unitPrice)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <CategoryBadge cat={p.category} />
                        {inCart
                          ? <CheckCircle size={13} className="text-emerald-400" />
                          : isAdding
                          ? <RefreshCw size={12} className="animate-spin text-violet-400" />
                          : <Plus size={13} className="text-zinc-500" />
                        }
                      </div>
                    </button>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <p className="col-span-3 text-xs text-zinc-500 text-center py-4">No products match your filter.</p>
                )}
              </div>
            </div>
          )}

          {/* Quote Lines */}
          <div className="flex-1 overflow-auto px-8 py-5">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShoppingCart size={12} /> Quote Lines ({q.lines.length})
            </p>

            {q.lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-zinc-800 rounded-xl">
                <ShoppingCart size={28} className="text-zinc-700 mb-3" />
                <p className="text-zinc-500 text-sm">No products added yet.</p>
                {isEditable && <p className="text-zinc-600 text-xs mt-1">Use the catalogue above to add products.</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Table header */}
                <div className="grid grid-cols-[2fr_1fr_1.2fr_1.2fr_1fr_auto] gap-3 px-4 py-2 text-xs text-zinc-500 font-medium">
                  <span>Product</span>
                  <span>Qty</span>
                  <span>Discount %</span>
                  <span>Line Total</span>
                  <span>Margin</span>
                  <span />
                </div>

                {q.lines.map(line => {
                  const isUpdating = lineUpdating === line.id;
                  const marginPctLine = parseFloat(line.marginPercent) || 0;
                  const marginColor = marginPctLine >= 30 ? 'text-emerald-400' : marginPctLine >= 15 ? 'text-amber-400' : 'text-red-400';

                  return (
                    <div
                      key={line.id}
                      className={`grid grid-cols-[2fr_1fr_1.2fr_1.2fr_1fr_auto] gap-3 items-center px-4 py-3 bg-zinc-900 border rounded-xl transition-all ${
                        line.isOverDiscountLimit ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800'
                      } ${isUpdating ? 'opacity-60' : ''}`}
                    >
                      {/* Product info */}
                      <div>
                        <p className="text-sm font-medium text-zinc-100 truncate">{line.productName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CategoryBadge cat={line.category} />
                          {line.isOverDiscountLimit && (
                            <span className="text-xs text-amber-400 flex items-center gap-0.5">
                              <AlertTriangle size={10} /> Over limit
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Qty */}
                      <div className="flex items-center gap-1">
                        {isEditable ? (
                          <>
                            <button onClick={() => updateLineQty(line.id, -1, line.quantity)} disabled={isUpdating || line.quantity <= 1}
                              className="w-6 h-6 rounded-md bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 disabled:opacity-40 transition">
                              <Minus size={11} />
                            </button>
                            <span className="w-7 text-center text-sm font-semibold text-zinc-100">{line.quantity}</span>
                            <button onClick={() => updateLineQty(line.id, 1, line.quantity)} disabled={isUpdating}
                              className="w-6 h-6 rounded-md bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 disabled:opacity-40 transition">
                              <Plus size={11} />
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-zinc-200">{line.quantity}</span>
                        )}
                      </div>

                      {/* Discount */}
                      <div>
                        {isEditable ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0} max={100} step={0.5}
                              defaultValue={parseFloat(line.discountPercent).toFixed(1)}
                              onBlur={e => updateLineDiscount(line.id, parseFloat(e.target.value) || 0)}
                              disabled={isUpdating}
                              className="w-16 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-violet-500 text-center"
                            />
                            <span className="text-xs text-zinc-500">%</span>
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-200">{parseFloat(line.discountPercent).toFixed(1)}%</span>
                        )}
                        {parseFloat(line.maxDiscountPercent) > 0 && (
                          <p className="text-xs text-zinc-600 mt-0.5">Max: {parseFloat(line.maxDiscountPercent).toFixed(0)}%</p>
                        )}
                      </div>

                      {/* Line total */}
                      <p className="text-sm font-semibold text-zinc-100">{fmt(line.lineTotal)}</p>

                      {/* Margin */}
                      <p className={`text-sm font-semibold ${marginColor}`}>{marginPctLine.toFixed(1)}%</p>

                      {/* Remove */}
                      {isEditable && (
                        <button
                          id={`remove-line-${line.id}`}
                          onClick={() => removeLine(line.id)}
                          disabled={isUpdating}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Fulfillment — appears the moment the deal is approved. The rep
                owns the deal end to end, so they can accept or override the
                warehouse split here rather than handing off to Operations. */}
            {q.status === 'APPROVED' && (
              <div className="mt-8 pt-6 border-t border-zinc-800">
                <FulfillmentPanel quotationId={q.id} canConfirm onChanged={() => showToast('Fulfillment updated')} />
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar: Totals + Upsell + Notes */}
        <div className="w-80 shrink-0 border-l border-zinc-800 overflow-auto flex flex-col">

          {/* Sidebar tab switcher — only when APPROVED */}
          {q.status === 'APPROVED' && (
            <div className="flex border-b border-zinc-800 shrink-0">
              {(['summary', 'billing'] as const).map(tab => (
                <button
                  key={tab}
                  id={`sidebar-tab-${tab}`}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-semibold capitalize transition ${
                    sidebarTab === tab
                      ? 'text-white border-b-2 border-violet-500 bg-violet-500/5'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab === 'billing' ? '💳 Billing' : '📋 Summary'}
                </button>
              ))}
            </div>
          )}

          {/* Billing tab body */}
          {sidebarTab === 'billing' && q.status === 'APPROVED' ? (
            <div className="flex-1 overflow-y-auto p-5">
              <BillingOverview
                quotationId={q.id}
                userRole="SALES_REPRESENTATIVE"
                showToast={showToast}
              />
            </div>
          ) : (
          <>

          {/* Order Totals */}
          <div className="p-5 border-b border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-4">Order Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>

                <span>{fmt(q.subtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Discounts</span>
                <span className="text-red-400">-{fmt(q.discountAmount)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Tax</span>
                <span>{fmt(q.taxAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-white text-base pt-2 border-t border-zinc-800">
                <span>Grand Total</span>
                <span>{fmt(q.grandTotal)}</span>
              </div>
            </div>

            <div className="mt-4">
              <MarginBar pct={marginPct} />
            </div>

            {riskScore >= 10 && (
              <div className={`mt-3 flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg border ${
                riskScore >= 50 ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}>
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>Risk score {riskScore.toFixed(1)} — will require{riskScore >= 50 ? ' Finance + ' : ' '}Manager approval</span>
              </div>
            )}

            {/* Order discount */}
            {isEditable && (
              <div className="mt-4">
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Order-level Discount %</label>
                <input
                  type="number" min={0} max={100} step={0.5}
                  value={orderDiscount}
                  onChange={e => setOrderDiscount(e.target.value)}
                  onBlur={handleDiscountBlur}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 transition"
                />
              </div>
            )}
          </div>

          {/* Upsell suggestions */}
          {isEditable && upsellSuggestions.length > 0 && (
            <div className="p-5 border-b border-zinc-800">
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Star size={11} className="text-amber-400" /> Suggested Add-ons
              </p>
              <div className="space-y-2">
                {upsellSuggestions.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <CategoryBadge cat={p.category} />
                        <span className="text-xs text-zinc-500">{fmt(p.unitPrice)}</span>
                      </div>
                    </div>
                    <button
                      id={`upsell-add-${p.id}`}
                      onClick={() => addProduct(p.id)}
                      disabled={!!adding}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition disabled:opacity-50 shrink-0"
                    >
                      <Plus size={11} /> Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="p-5">
            <label className="block text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText size={11} /> Internal Notes
            </label>
            <textarea
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              disabled={!isEditable}
              rows={5}
              placeholder="Deal context, special instructions…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none transition disabled:opacity-50"
            />
          </div>
          </>
          )}
        </div>
      </div>
      
      {/* Plan Selection Modal */}
      {planSelectProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Select Subscription Plan</h3>
            <p className="text-sm text-zinc-400 mb-6">Choose a billing cycle for {planSelectProduct.name}</p>
            <div className="space-y-3 mb-6">
              {subscriptionPlans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => addProduct(planSelectProduct.id, plan.id)}
                  className="w-full flex items-center justify-between p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-violet-500/50 rounded-xl transition text-left group"
                >
                  <div>
                    <p className="font-semibold text-zinc-200 group-hover:text-white">{plan.name}</p>
                    <p className="text-xs text-zinc-500">{plan.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-violet-400">
                      {fmt(Number(planSelectProduct.unitPrice) * Number(plan.priceMultiplier))}
                    </p>
                    <p className="text-xs text-zinc-500">per {plan.billingCycle.toLowerCase()}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPlanSelectProduct(null)}
              className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>

  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function SalesWorkspace() {
  const [view, setView] = useState<'list' | 'builder'>('list');
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/quotations', { params: { limit: 50 } });
      setQuotations(r.data.data);
    } catch { showToast('Failed to load quotations', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadList(); }, [loadList]);

  const openBuilder = async (q: Quotation) => {
    try {
      const r = await api.get(`/quotations/${q.id}`);
      setSelected(r.data.data);
      setView('builder');
    } catch { showToast('Failed to load quotation', 'error'); }
  };

  const exitBuilder = () => {
    setView('list');
    setSelected(null);
    loadList();
  };

  return (
    <AppShell>
      {view === 'list' ? (
        <QuotationListView
          quotations={quotations}
          loading={loading}
          onOpen={openBuilder}
          onNew={() => setShowCreateModal(true)}
          onRefresh={loadList}
        />
      ) : selected ? (
        <QuotationBuilderView
          initialQuotation={selected}
          onBack={exitBuilder}
          showToast={showToast}
        />
      ) : null}

      {showCreateModal && (
          <CreateQuotationModal
            onClose={() => setShowCreateModal(false)}
            onCreated={async (q) => {
              setShowCreateModal(false);
              setSelected(q);
              setView('builder');
            }}
            showToast={showToast}
          />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </AppShell>
  );
}
