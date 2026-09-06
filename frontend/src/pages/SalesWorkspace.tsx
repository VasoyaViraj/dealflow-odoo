import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '../components/layout/AppShell';
import {
  Plus, ArrowLeft, ShoppingCart, Package, RefreshCw,
  Trash2, AlertTriangle, CheckCircle, ChevronRight,
  Search, Send, X, Star, Info,
  FileText, Minus, Clock, Users
} from 'lucide-react';
import api from '../lib/api';
import { StatusBadge, CategoryBadge, TierBadge } from '../components/ui/badges';
import { getProducts, getSubscriptionPlans } from '../lib/referenceData';
import FulfillmentPanel from '../components/fulfillment/FulfillmentPanel';
import { BillingOverview } from '../components/billing/BillingOverview';
import type { SubscriptionPlan } from '../types/billing';
import Loader from '../components/ui/Loader';
import Pagination from '../components/ui/Pagination';
import { SyncLoader } from 'react-spinners';

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

function MarginBar({ pct }: { pct: number }) {
  const color = pct >= 30 ? '#006400' : pct >= 15 ? '#d9a441' : '#aa2d00';
  const label = pct >= 30 ? 'Healthy' : pct >= 15 ? 'Slim' : 'Low';
  const labelColor = pct >= 30 ? 'text-success' : pct >= 15 ? 'text-warning' : 'text-coral';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-subtle">Margin</span>
        <span className={`font-bold ${labelColor}`}>{pct.toFixed(1)}% · {label}</span>
      </div>
      <div className="w-full h-1.5 bg-soft rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct * 2, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function RiskBadge({ score }: { score: string }) {
  const n = parseFloat(score);
  if (n >= 50) return <span className="flex items-center gap-1 text-xs font-bold text-coral bg-coral/8 border border-coral/30 px-2 py-0.5 rounded-full"><AlertTriangle size={10} />High Risk</span>;
  if (n >= 10) return <span className="flex items-center gap-1 text-xs font-bold text-warning bg-mustard/20 border border-mustard/60 px-2 py-0.5 rounded-full"><AlertTriangle size={10} />Med Risk</span>;
  return null;
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-lg shadow-lg text-sm font-medium text-white
 ${type === 'success' ? 'bg-ink' : 'bg-coral'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
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
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-canvas border border-hairline rounded-lg p-6 w-full max-w-md shadow-lg">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-ink">New Quotation</h2>
            <button onClick={onClose} className="text-subtle hover:text-body transition"><X size={18} /></button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-subtle mb-1.5 font-medium">Customer *</label>
              {fetching ? (
                <Loader loading={fetching} size={6} />
              ) : (
                <select
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  className="w-full bg-soft border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink transition"
                >
                  <option value="">— Select a customer —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.tier})</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm text-subtle mb-1.5 font-medium">Notes <span className="text-line-strong">(optional)</span></label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Internal notes for this quotation…"
                rows={3}
                className="w-full bg-soft border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink placeholder-line-strong focus:outline-none focus:border-ink resize-none transition"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-subtle hover:text-ink border border-hairline hover:border-line-strong transition">Cancel</button>
            <button
              id="create-quotation-submit"
              onClick={create}
              disabled={loading || !customerId}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-ink text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <SyncLoader color="#fff" size={6} margin={2} /> : 'Create Quotation'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Create Customer Modal ─────────────────────────────────────────────────────

function CreateCustomerModal({
  onClose, onCreated, showToast,
}: {
  onClose: () => void;
  onCreated: (c: any, pwd: string) => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tier, setTier] = useState('BRONZE');
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!name || !email) { showToast('Name and Email are required', 'error'); return; }
    setLoading(true);
    try {
      const r = await api.post('/customers', { name, email, phone, tier });
      onCreated(r.data.data, r.data.autoGeneratedPassword);
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Failed to create customer', 'error');
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-canvas border border-hairline rounded-lg p-6 w-full max-w-md shadow-lg">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-ink">New Customer</h2>
            <button onClick={onClose} className="text-subtle hover:text-body transition"><X size={18} /></button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-subtle mb-1.5 font-medium">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-soft border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink transition" placeholder="Acme Corp" />
            </div>
            <div>
              <label className="block text-sm text-subtle mb-1.5 font-medium">Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-soft border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink transition" placeholder="contact@acme.com" />
            </div>
            <div>
              <label className="block text-sm text-subtle mb-1.5 font-medium">Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-soft border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink transition" placeholder="+1 555-0123" />
            </div>
            <div>
              <label className="block text-sm text-subtle mb-1.5 font-medium">Tier</label>
              <select value={tier} onChange={e => setTier(e.target.value)} className="w-full bg-soft border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-ink transition">
                <option value="BRONZE">Bronze</option>
                <option value="SILVER">Silver</option>
                <option value="GOLD">Gold</option>
              </select>
            </div>
            <p className="text-xs text-subtle mt-2 flex items-center gap-1.5 bg-soft p-2 rounded">
              <Info size={12} /> A portal user account will be generated automatically.
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-subtle hover:text-ink border border-hairline hover:border-line-strong transition">Cancel</button>
            <button
              onClick={create}
              disabled={loading || !name || !email}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-ink text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <SyncLoader color="#fff" size={6} margin={2} /> : 'Create Customer'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Quotation List View ───────────────────────────────────────────────────────

function QuotationListView({
  quotations, loading, onOpen, onNew, onNewCustomer, onRefresh,
  currentPage, totalPages, onPageChange,
}: {
  quotations: Quotation[];
  loading: boolean;
  onOpen: (q: Quotation) => void;
  onNew: () => void;
  onNewCustomer: () => void;
  onRefresh: () => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const pending = quotations.filter(q => ['PENDING_MANAGER', 'PENDING_FINANCE'].includes(q.status)).length;
  const approved = quotations.filter(q => q.status === 'APPROVED').length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink">Sales Workspace</h1>
          <p className="text-subtle text-sm mt-1">Create and manage your quotations.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 bg-soft border border-hairline text-body hover:text-ink rounded-lg text-sm transition">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={onNewCustomer}
            className="flex items-center gap-2 px-4 py-2 bg-canvas border border-hairline hover:border-line-strong text-ink text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <Users size={15} /> New Customer
          </button>
          <button
            id="new-quotation-btn"
            onClick={onNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-ink text-white text-sm font-semibold rounded-lg shadow-lg transition"
          >
            <Plus size={15} /> New Quotation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Quotations', value: quotations.length, icon: <FileText size={18} />, color: 'text-body' },
          { label: 'Pending Approval', value: pending, icon: <Clock size={18} />, color: 'text-warning' },
          { label: 'Approved', value: approved, icon: <CheckCircle size={18} />, color: 'text-success' },
        ].map(s => (
          <div key={s.label} className="bg-canvas border border-hairline rounded-md px-5 py-4 flex items-center gap-4">
            <div className={`${s.color} opacity-60`}>{s.icon}</div>
            <div>
              <p className="text-xs text-subtle font-medium">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quotation Cards */}
      {loading ? (
        <div className="py-20"><Loader loading={true} /></div>
      ) : quotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-lg bg-cream border border-hairline flex items-center justify-center mb-4">
            <ShoppingCart size={28} className="text-link" />
          </div>
          <h2 className="text-lg font-semibold text-ink">No quotations yet</h2>
          <p className="text-subtle text-sm mt-2 max-w-sm">Create your first quotation to start building deals.</p>
          <button onClick={onNew} className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-ink hover:bg-ink-active text-white text-sm font-semibold rounded-lg transition">
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
              className="bg-canvas border border-hairline hover:border-line-strong hover:bg-soft rounded-lg p-5 flex flex-col gap-3 cursor-pointer transition-all duration-200 group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-subtle font-mono">{q.quotationNumber}</p>
                  <p className="font-semibold text-ink text-base mt-0.5">{q.customer?.name ?? '—'}</p>
                  <p className="text-xs text-subtle mt-0.5">{q.customer && <TierBadge tier={q.customer.tier} />}</p>
                </div>
                <ChevronRight size={18} className="text-line-strong group-hover:text-body transition mt-1" />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={q.status} />
                {parseFloat(q.blendedRiskScore) > 0 && <RiskBadge score={q.blendedRiskScore} />}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-soft rounded-md px-3 py-2.5">
                  <p className="text-xs text-subtle mb-0.5">Grand Total</p>
                  <p className="text-sm font-bold text-ink">{fmt(q.grandTotal)}</p>
                </div>
                <div className="bg-soft rounded-md px-3 py-2.5">
                  <p className="text-xs text-subtle mb-0.5">Lines</p>
                  <p className="text-sm font-bold text-ink">{q.lines?.length ?? '—'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-hairline text-xs text-subtle">
                <span className="flex items-center gap-1"><Clock size={11} /> {timeAgo(q.updatedAt)}</span>
                <span className="text-link font-medium group-hover:text-link-active transition">Open →</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && quotations.length > 0 && (
        <div className="mt-6">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
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

  const isEditable = q && ['DRAFT', 'REVISION_REQUESTED', 'NEGOTIATION_REQUESTED'].includes(q.status);

  useEffect(() => {
    getProducts().then(setProducts);
    getSubscriptionPlans().then(setSubscriptionPlans).catch(() => { });
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
      <div className="flex items-center justify-between px-8 py-4 border-b border-hairline shrink-0 bg-soft">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-subtle hover:text-ink transition">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="w-px h-5 bg-soft" />
          <div>
            <span className="text-xs text-subtle font-mono">{q.quotationNumber}</span>
            <h1 className="text-base font-bold text-ink leading-none mt-0.5">{q.customer?.name}</h1>
          </div>
          <StatusBadge status={q.status} />
          {riskScore >= 10 && <RiskBadge score={q.blendedRiskScore} />}
        </div>
        {isEditable && !submitted && (
          <button
            id="submit-quotation-btn"
            onClick={submitQuotation}
            disabled={submitting || q.lines.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-ink text-white text-sm font-semibold rounded-lg shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} /> {submitting ? 'Submitting…' : 'Submit for Approval'}
          </button>
        )}
        {!isEditable && (
          <div className="text-xs text-subtle flex items-center gap-1.5">
            <Info size={13} /> Read-only — quotation submitted
          </div>
        )}
      </div>

      {/* Submitted banner */}
      {submitted && (
        <div className={`mx-8 mt-4 flex items-center gap-3 px-5 py-4 rounded-md border text-sm font-medium
 ${q.requiresApproval
            ? 'bg-cream border-hairline text-link'
            : 'bg-success/10 border-success/30 text-success'}`}>
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
            <div className="border-b border-hairline px-8 py-5 bg-soft">
              <p className="text-xs text-subtle font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                <Package size={12} /> Product Catalogue — Click to add
              </p>
              {/* Category tabs + search */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex gap-1 bg-canvas border border-hairline rounded-lg p-1">
                  {(['ALL', 'HARDWARE', 'SERVICES', 'SUBSCRIPTION'] as const).map(c => (
                    <button
                      key={c}
                      id={`cat-tab-${c.toLowerCase()}`}
                      onClick={() => setCatFilter(c)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${catFilter === c ? 'bg-ink text-white' : 'text-subtle hover:text-ink hover:bg-soft'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 max-w-xs">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                  <input
                    type="text"
                    placeholder="Search products…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-canvas border border-hairline rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder-line-strong focus:outline-none focus:border-ink transition"
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
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-all text-sm ${inCart
                          ? 'bg-soft border-hairline cursor-default opacity-50'
                          : 'bg-soft border-hairline hover:border-ink hover:bg-cream cursor-pointer'
                        }`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-ink truncate text-xs">{p.name}</p>
                        <p className="text-subtle text-xs">{fmt(p.unitPrice)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <CategoryBadge cat={p.category} />
                        {inCart
                          ? <CheckCircle size={13} className="text-success" />
                          : isAdding
                            ? <RefreshCw size={12} className="animate-spin text-link" />
                            : <Plus size={13} className="text-subtle" />
                        }
                      </div>
                    </button>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <p className="col-span-3 text-xs text-subtle text-center py-4">No products match your filter.</p>
                )}
              </div>
            </div>
          )}

          {/* Quote Lines */}
          <div className="flex-1 overflow-auto px-8 py-5">
            <p className="text-xs text-subtle font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShoppingCart size={12} /> Quote Lines ({q.lines.length})
            </p>

            {q.lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-hairline rounded-md">
                <ShoppingCart size={28} className="text-subtle mb-3" />
                <p className="text-subtle text-sm">No products added yet.</p>
                {isEditable && <p className="text-line-strong text-xs mt-1">Use the catalogue above to add products.</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Table header */}
                <div className="grid grid-cols-[2fr_1fr_1.2fr_1.2fr_1fr_auto] gap-3 px-4 py-2 text-xs text-subtle font-medium">
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
                  const marginColor = marginPctLine >= 30 ? 'text-success' : marginPctLine >= 15 ? 'text-warning' : 'text-coral';

                  return (
                    <div
                      key={line.id}
                      className={`grid grid-cols-[2fr_1fr_1.2fr_1.2fr_1fr_auto] gap-3 items-center px-4 py-3 bg-canvas border rounded-md transition-all ${line.isOverDiscountLimit ? 'border-mustard/60 bg-mustard/20' : 'border-hairline'
                        } ${isUpdating ? 'opacity-60' : ''}`}
                    >
                      {/* Product info */}
                      <div>
                        <p className="text-sm font-medium text-ink truncate">{line.productName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CategoryBadge cat={line.category} />
                          {line.isOverDiscountLimit && (
                            <span className="text-xs text-warning flex items-center gap-0.5">
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
                              className="w-6 h-6 rounded-md bg-soft hover:bg-strong flex items-center justify-center text-subtle disabled:opacity-40 transition">
                              <Minus size={11} />
                            </button>
                            <span className="w-7 text-center text-sm font-semibold text-ink">{line.quantity}</span>
                            <button onClick={() => updateLineQty(line.id, 1, line.quantity)} disabled={isUpdating}
                              className="w-6 h-6 rounded-md bg-soft hover:bg-strong flex items-center justify-center text-subtle disabled:opacity-40 transition">
                              <Plus size={11} />
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-ink">{line.quantity}</span>
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
                              className="w-16 bg-soft border border-hairline rounded-md px-2 py-1 text-xs text-ink focus:outline-none focus:border-ink text-center"
                            />
                            <span className="text-xs text-subtle">%</span>
                          </div>
                        ) : (
                          <span className="text-sm text-ink">{parseFloat(line.discountPercent).toFixed(1)}%</span>
                        )}
                        {parseFloat(line.maxDiscountPercent) > 0 && (
                          <p className="text-xs text-line-strong mt-0.5">Max: {parseFloat(line.maxDiscountPercent).toFixed(0)}%</p>
                        )}
                      </div>

                      {/* Line total */}
                      <p className="text-sm font-semibold text-ink">{fmt(line.lineTotal)}</p>

                      {/* Margin */}
                      <p className={`text-sm font-semibold ${marginColor}`}>{marginPctLine.toFixed(1)}%</p>

                      {/* Remove */}
                      {isEditable && (
                        <button
                          id={`remove-line-${line.id}`}
                          onClick={() => removeLine(line.id)}
                          disabled={isUpdating}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-line-strong hover:text-coral hover:bg-coral/8 transition disabled:opacity-40"
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
              <div className="mt-8 pt-6 border-t border-hairline">
                <FulfillmentPanel quotationId={q.id} canConfirm onChanged={() => showToast('Fulfillment updated')} />
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar: Totals + Upsell + Notes */}
        <div className="w-80 shrink-0 border-l border-hairline overflow-auto flex flex-col">

          {/* Sidebar tab switcher — only when APPROVED */}
          {q.status === 'APPROVED' && (
            <div className="flex border-b border-hairline shrink-0">
              {(['summary', 'billing'] as const).map(tab => (
                <button
                  key={tab}
                  id={`sidebar-tab-${tab}`}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-semibold capitalize transition ${sidebarTab === tab
                      ? 'text-ink border-b-2 border-ink bg-cream'
                      : 'text-subtle hover:text-body'
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
              <div className="p-5 border-b border-hairline">
                <p className="text-xs text-subtle font-semibold uppercase tracking-wider mb-4">Order Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-subtle">
                    <span>Subtotal</span>

                    <span>{fmt(q.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-subtle">
                    <span>Discounts</span>
                    <span className="text-coral">-{fmt(q.discountAmount)}</span>
                  </div>
                  <div className="flex justify-between text-subtle">
                    <span>Tax</span>
                    <span>{fmt(q.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-ink text-base pt-2 border-t border-hairline">
                    <span>Grand Total</span>
                    <span>{fmt(q.grandTotal)}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <MarginBar pct={marginPct} />
                </div>

                {riskScore >= 10 && (
                  <div className={`mt-3 flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg border ${riskScore >= 50 ? 'bg-coral/8 border-coral/30 text-coral' : 'bg-mustard/20 border-mustard/60 text-warning'
                    }`}>
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>Risk score {riskScore.toFixed(1)} — will require{riskScore >= 50 ? ' Finance + ' : ' '}Manager approval</span>
                  </div>
                )}

                {/* Order discount */}
                {isEditable && (
                  <div className="mt-4">
                    <label className="block text-xs text-subtle mb-1.5 font-medium">Order-level Discount %</label>
                    <input
                      type="number" min={0} max={100} step={0.5}
                      value={orderDiscount}
                      onChange={e => setOrderDiscount(e.target.value)}
                      onBlur={handleDiscountBlur}
                      className="w-full bg-soft border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink transition"
                    />
                  </div>
                )}
              </div>

              {/* Upsell suggestions */}
              {isEditable && upsellSuggestions.length > 0 && (
                <div className="p-5 border-b border-hairline">
                  <p className="text-xs text-subtle font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Star size={11} className="text-warning" /> Suggested Add-ons
                  </p>
                  <div className="space-y-2">
                    {upsellSuggestions.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2 bg-soft border border-hairline rounded-lg px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-ink truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <CategoryBadge cat={p.category} />
                            <span className="text-xs text-subtle">{fmt(p.unitPrice)}</span>
                          </div>
                        </div>
                        <button
                          id={`upsell-add-${p.id}`}
                          onClick={() => addProduct(p.id)}
                          disabled={!!adding}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-ink hover:bg-ink-active text-white transition disabled:opacity-50 shrink-0"
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
                <label className="block text-xs text-subtle font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={11} /> Internal Notes
                </label>
                <textarea
                  value={notes}
                  onChange={e => handleNotesChange(e.target.value)}
                  disabled={!isEditable}
                  rows={5}
                  placeholder="Deal context, special instructions…"
                  className="w-full bg-soft border border-hairline rounded-lg px-3 py-2.5 text-xs text-ink placeholder-line-strong focus:outline-none focus:border-ink resize-none transition disabled:opacity-50"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Plan Selection Modal */}
      {planSelectProduct && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-canvas border border-hairline rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-bold text-ink mb-2">Select Subscription Plan</h3>
            <p className="text-sm text-subtle mb-6">Choose a billing cycle for {planSelectProduct.name}</p>
            <div className="space-y-3 mb-6">
              {subscriptionPlans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => addProduct(planSelectProduct.id, plan.id)}
                  className="w-full flex items-center justify-between p-4 bg-soft  border border-hairline hover:border-ink rounded-md transition text-left group"
                >
                  <div>
                    <p className="font-semibold text-ink group-">{plan.name}</p>
                    <p className="text-xs text-subtle">{plan.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-link">
                      {fmt(Number(planSelectProduct.unitPrice) * Number(plan.priceMultiplier))}
                    </p>
                    <p className="text-xs text-subtle">per {plan.billingCycle.toLowerCase()}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPlanSelectProduct(null)}
              className="w-full px-4 py-2 bg-soft hover:bg-strong text-ink text-sm font-semibold rounded-lg transition"
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string, pass: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadList = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const r = await api.get('/quotations', { params: { limit: 12, page } });
      setQuotations(r.data.data);
      if (r.data.pagination) {
        setTotalPages(r.data.pagination.pages);
        setCurrentPage(r.data.pagination.page);
      }
    } catch { showToast('Failed to load quotations', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadList(1); }, [loadList]);

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
    loadList(currentPage);
  };

  return (
    <AppShell>
      {view === 'list' && (
        <QuotationListView
          quotations={quotations}
          loading={loading}
          onOpen={openBuilder}
          onNew={() => setShowCreateModal(true)}
          onNewCustomer={() => setShowCustomerModal(true)}
          onRefresh={() => loadList(currentPage)}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={loadList}
        />
      )}
      {view === 'builder' && selected && (
        <QuotationBuilderView
          initialQuotation={selected}
          onBack={exitBuilder}
          showToast={showToast}
        />
      )}

      {showCreateModal && (
        <CreateQuotationModal
          onClose={() => setShowCreateModal(false)}
          onCreated={q => { setShowCreateModal(false); loadList(1); setSelected(q); setView('builder'); }}
          showToast={showToast}
        />
      )}

      {showCustomerModal && (
        <CreateCustomerModal
          onClose={() => setShowCustomerModal(false)}
          onCreated={(c, pwd) => {
            setShowCustomerModal(false);
            setCreatedCredentials({ email: c.email, pass: pwd });
            showToast('Customer & Portal Account created successfully', 'success');
          }}
          showToast={showToast}
        />
      )}

      {createdCredentials && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-canvas border border-hairline rounded-lg p-6 w-full max-w-sm shadow-lg text-center">
            <div className="mx-auto w-12 h-12 bg-success/10 text-success rounded-full flex items-center justify-center mb-4"><CheckCircle size={24} /></div>
            <h3 className="text-lg font-bold text-ink mb-2">Account Created</h3>
            <p className="text-sm text-subtle mb-4">Share these credentials with the customer so they can log into the portal:</p>
            <div className="bg-soft border border-hairline rounded p-3 text-left space-y-2 text-sm font-mono text-ink mb-6">
              <p>Email: {createdCredentials.email}</p>
              <p>Pass:  {createdCredentials.pass}</p>
            </div>
            <button onClick={() => setCreatedCredentials(null)} className="w-full py-2.5 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink-active">
              Done
            </button>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </AppShell>
  );
}
