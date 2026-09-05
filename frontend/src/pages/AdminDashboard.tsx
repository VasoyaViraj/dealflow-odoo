import { useState, useEffect, useCallback } from 'react';
import AppShell from '../components/layout/AppShell';
import api from '../lib/api';
import {
  Users, Package, Percent, Warehouse, RefreshCw, Truck,
  Plus, Pencil, Check, X, AlertCircle, Boxes
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer { id: string; name: string; email: string; phone?: string; tier: string; isActive: boolean; }
interface Product { id: string; name: string; sku?: string; category: string; unitPrice: string; costPrice: string; taxRate: string; isActive: boolean; }
interface DiscountTier { id: string; tier: string; maxDiscountPct: string; }
interface CategoryLimit { id: string; category: string; maxDiscountPct: string; }
interface WarehouseRow {
  id: string;
  name: string;
  location?: string;
  isActive: boolean;
  /** Fulfillment economics — numeric columns arrive as strings. */
  shippingBaseCost?: string | number;
  costPerUnit?: string | number;
  deliveryDays?: number;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}
interface InventoryRow { id: string; productName: string; productSku?: string; warehouseName: string; quantity: number; warehouseId: string; productId: string; }
interface SubPlan { id: string; name: string; billingCycle: string; priceMultiplier: string; description?: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    GOLD: 'bg-mustard/20 text-warning border-mustard/60',
    SILVER: 'bg-strong text-body border-hairline',
    BRONZE: 'bg-coral/8 text-coral border-coral/30',
  };
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${colors[tier] ?? 'bg-strong text-body'}`}>
      {tier}
    </span>
  );
}

function CategoryBadge({ cat }: { cat: string }) {
  const colors: Record<string, string> = {
    HARDWARE: 'bg-link/10 text-link border-link/30',
    SERVICES: 'bg-success/10 text-success border-success/30',
    SUBSCRIPTION: 'bg-cream text-ink border-hairline',
  };
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${colors[cat] ?? 'bg-strong text-body'}`}>
      {cat}
    </span>
  );
}

function SectionHeader({ title, onAdd, addLabel }: { title: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 bg-ink hover:bg-ink-active text-white text-sm font-medium px-3.5 py-2 rounded-lg transition-all"
        >
          <Plus size={15} /> {addLabel ?? 'Add'}
        </button>
      )}
    </div>
  );
}

function InlineEdit({
  value,
  onSave,
  type = 'text',
  min,
  max,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  type?: string;
  min?: string;
  max?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await onSave(draft); setEditing(false); }
    finally { setSaving(false); }
  };

  if (!editing) return (
    <span className="flex items-center gap-2 group">
      <span>{value}</span>
      <button onClick={() => { setDraft(value); setEditing(true); }}
        className="opacity-0 group-hover:opacity-100 transition text-subtle hover:text-link">
        <Pencil size={13} />
      </button>
    </span>
  );

  return (
    <span className="flex items-center gap-1">
      <input
        type={type}
        value={draft}
        min={min}
        max={max}
        step="0.01"
        onChange={e => setDraft(e.target.value)}
        className="bg-strong border border-ink rounded px-2 py-0.5 text-sm text-ink w-24 focus:outline-none"
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      />
      <button onClick={save} disabled={saving} className="text-success ">
        <Check size={14} />
      </button>
      <button onClick={() => setEditing(false)} className="text-subtle hover:text-coral">
        <X size={14} />
      </button>
    </span>
  );
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-md shadow-lg text-sm font-medium border
 ${type === 'success' ? 'bg-soft text-success border-success/30' : 'bg-soft text-coral border-coral/30'}`}>
      {type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
      {msg}
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'customers',    label: 'Customers',      icon: <Users size={16} /> },
  { id: 'products',     label: 'Products',        icon: <Package size={16} /> },
  { id: 'discounts',    label: 'Discount Config', icon: <Percent size={16} /> },
  { id: 'warehouses',   label: 'Warehouses',      icon: <Warehouse size={16} /> },
  { id: 'inventory',    label: 'Inventory',       icon: <Boxes size={16} /> },
  { id: 'plans',        label: 'Subscriptions',   icon: <RefreshCw size={16} /> },
  { id: 'fulfillment',  label: 'Fulfillment Rules', icon: <Truck size={16} /> },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('customers');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <AppShell>
      <div className="p-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink">Admin Configuration</h1>
          <p className="text-subtle text-sm mt-1">Manage master data — all business rules are driven by these settings.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-canvas border border-hairline rounded-md p-1 mb-8 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
 activeTab === tab.id
 ? 'bg-ink text-white shadow-lg'
 : 'text-subtle hover:text-ink hover:bg-soft'
 }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Panels */}
        <div className="bg-canvas border border-hairline rounded-lg p-6">
          {activeTab === 'customers'  && <CustomersTab showToast={showToast} />}
          {activeTab === 'products'   && <ProductsTab showToast={showToast} />}
          {activeTab === 'discounts'  && <DiscountsTab showToast={showToast} />}
          {activeTab === 'warehouses' && <WarehousesTab showToast={showToast} />}
          {activeTab === 'inventory'  && <InventoryTab showToast={showToast} />}
          {activeTab === 'plans'      && <PlansTab showToast={showToast} />}
          {activeTab === 'fulfillment' && <FulfillmentRulesTab showToast={showToast} />}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </AppShell>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────

function CustomersTab({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', tier: 'SILVER' });

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/admin/customers'); setRows(r.data.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await api.post('/admin/customers', form);
      showToast(`Customer "${form.name}" created`);
      setShowForm(false);
      setForm({ name: '', email: '', phone: '', tier: 'SILVER' });
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? 'Failed to create customer', 'error');
    }
  };

  const updateTier = async (id: string, tier: string) => {
    await api.put(`/admin/customers/${id}`, { tier });
    showToast('Tier updated');
    load();
  };

  return (
    <div>
      <SectionHeader title="Customers" onAdd={() => setShowForm(v => !v)} addLabel="New Customer" />

      {showForm && (
        <div className="bg-soft border border-hairline rounded-md p-5 mb-5 grid grid-cols-4 gap-3">
          <input placeholder="Company name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />
          <input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />
          <input placeholder="Phone (optional)" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />
          <select value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink">
            <option>BRONZE</option><option>SILVER</option><option>GOLD</option>
          </select>
          <div className="col-span-4 flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-subtle hover:text-ink">Cancel</button>
            <button onClick={create} className="px-4 py-2 bg-ink hover:bg-ink-active text-white text-sm rounded-lg font-medium">Save</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-subtle">Loading…</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-subtle text-left">
              <th className="pb-3 pr-4 font-medium">Company</th>
              <th className="pb-3 pr-4 font-medium">Email</th>
              <th className="pb-3 pr-4 font-medium">Tier</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-hairline hover:bg-soft transition">
                <td className="py-3 pr-4 font-medium text-ink">{r.name}</td>
                <td className="py-3 pr-4 text-subtle">{r.email}</td>
                <td className="py-3 pr-4">
                  <select
                    value={r.tier}
                    onChange={e => updateTier(r.id, e.target.value)}
                    className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
                    style={{ color: r.tier === 'GOLD' ? '#8a5a00' : r.tier === 'SILVER' ? '#41454d' : '#aa2d00' }}
                  >
                    <option value="BRONZE">BRONZE</option>
                    <option value="SILVER">SILVER</option>
                    <option value="GOLD">GOLD</option>
                  </select>
                </td>
                <td className="py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.isActive ? 'bg-success/10 text-success' : 'bg-strong text-subtle'}`}>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

function ProductsTab({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', description: '', category: 'HARDWARE', unitPrice: '', costPrice: '', taxRate: '18' });

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/admin/products'); setRows(r.data.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await api.post('/admin/products', form);
      showToast(`Product "${form.name}" created`);
      setShowForm(false);
      setForm({ name: '', sku: '', description: '', category: 'HARDWARE', unitPrice: '', costPrice: '', taxRate: '18' });
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? 'Failed to create product', 'error');
    }
  };

  const updateField = async (id: string, field: string, value: string) => {
    await api.put(`/admin/products/${id}`, { [field]: value });
    showToast('Product updated');
    load();
  };

  return (
    <div>
      <SectionHeader title="Products" onAdd={() => setShowForm(v => !v)} addLabel="New Product" />

      {showForm && (
        <div className="bg-soft border border-hairline rounded-md p-5 mb-5 grid grid-cols-3 gap-3">
          <input placeholder="Product name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />
          <input placeholder="SKU (optional)" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink">
            <option>HARDWARE</option><option>SERVICES</option><option>SUBSCRIPTION</option>
          </select>
          <input placeholder="Unit price *" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />
          <input placeholder="Cost price *" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />
          <input placeholder="Tax rate (%) default 18" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />
          <input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="col-span-3 bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />
          <div className="col-span-3 flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-subtle hover:text-ink">Cancel</button>
            <button onClick={create} className="px-4 py-2 bg-ink hover:bg-ink-active text-white text-sm rounded-lg font-medium">Save</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-10 text-subtle">Loading…</div> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-subtle text-left">
              <th className="pb-3 pr-4 font-medium">Name</th>
              <th className="pb-3 pr-4 font-medium">SKU</th>
              <th className="pb-3 pr-4 font-medium">Category</th>
              <th className="pb-3 pr-4 font-medium">Unit Price ($)</th>
              <th className="pb-3 pr-4 font-medium">Cost ($)</th>
              <th className="pb-3 font-medium">Tax %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-hairline hover:bg-soft transition">
                <td className="py-3 pr-4 font-medium text-ink">{r.name}</td>
                <td className="py-3 pr-4 text-subtle font-mono text-xs">{r.sku ?? '—'}</td>
                <td className="py-3 pr-4"><CategoryBadge cat={r.category} /></td>
                <td className="py-3 pr-4 text-ink">
                  <InlineEdit value={r.unitPrice} onSave={v => updateField(r.id, 'unitPrice', v)} type="number" min="0" />
                </td>
                <td className="py-3 pr-4 text-ink">
                  <InlineEdit value={r.costPrice} onSave={v => updateField(r.id, 'costPrice', v)} type="number" min="0" />
                </td>
                <td className="py-3 text-ink">
                  <InlineEdit value={r.taxRate} onSave={v => updateField(r.id, 'taxRate', v)} type="number" min="0" max="100" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Discounts Tab ────────────────────────────────────────────────────────────

function DiscountsTab({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [tiers, setTiers] = useState<DiscountTier[]>([]);
  const [cats, setCats] = useState<CategoryLimit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c] = await Promise.all([
        api.get('/admin/discount-tiers'),
        api.get('/admin/category-limits'),
      ]);
      setTiers(t.data.data);
      setCats(c.data.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateTier = async (id: string, pct: string) => {
    await api.put(`/admin/discount-tiers/${id}`, { maxDiscountPct: pct });
    showToast('Tier discount updated — quotation engine will use this immediately');
    load();
  };

  const updateCat = async (id: string, pct: string) => {
    await api.put(`/admin/category-limits/${id}`, { maxDiscountPct: pct });
    showToast('Category limit updated');
    load();
  };

  if (loading) return <div className="text-center py-10 text-subtle">Loading…</div>;

  return (
    <div className="space-y-8">
      {/* Key demo callout */}
      <div className="bg-cream border border-hairline rounded-md px-5 py-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-link mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-link">Data-Driven Demo</p>
          <p className="text-xs text-link mt-1">
            Change Gold from <strong>15%</strong> to <strong>18%</strong> below — the quotation engine in Phase 3 will automatically use the new value. No code changes needed.
          </p>
        </div>
      </div>

      {/* Customer Tier Discounts */}
      <div>
        <SectionHeader title="Customer Tier — Max Discount %" />
        <div className="grid grid-cols-3 gap-4">
          {tiers.map(t => (
            <div key={t.id} className={`rounded-md p-5 border ${
 t.tier === 'GOLD' ? 'bg-mustard/20 border-mustard/60' :
 t.tier === 'SILVER' ? 'bg-strong border-hairline' :
 'bg-coral/8 border-coral/30'
 }`}>
              <TierBadge tier={t.tier} />
              <div className="mt-3 flex items-end gap-1">
                <InlineEdit
                  value={t.maxDiscountPct}
                  onSave={v => updateTier(t.id, v)}
                  type="number"
                  min="0"
                  max="100"
                />
                <span className="text-subtle text-sm mb-0.5">% max</span>
              </div>
              <p className="text-xs text-line-strong mt-2">Click the pencil to edit</p>
            </div>
          ))}
        </div>
      </div>

      {/* Category Discount Limits */}
      <div>
        <SectionHeader title="Category — Hard Cap %" />
        <div className="grid grid-cols-3 gap-4">
          {cats.map(c => (
            <div key={c.id} className="rounded-md p-5 bg-soft border border-hairline">
              <CategoryBadge cat={c.category} />
              <div className="mt-3 flex items-end gap-1">
                <InlineEdit
                  value={c.maxDiscountPct}
                  onSave={v => updateCat(c.id, v)}
                  type="number"
                  min="0"
                  max="100"
                />
                <span className="text-subtle text-sm mb-0.5">% cap</span>
              </div>
              <p className="text-xs text-line-strong mt-2">Risk engine uses this cap</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Warehouses Tab ───────────────────────────────────────────────────────────
//
// A warehouse is not just a place — its shipping cost, lead time and business
// priority are the only inputs the fulfillment planner has (this build carries
// no distance model), so these four fields are what an admin tunes to change
// which split the engine recommends.

const PRIORITIES: Array<'HIGH' | 'MEDIUM' | 'LOW'> = ['HIGH', 'MEDIUM', 'LOW'];

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'bg-cream text-ink border-hairline',
  MEDIUM: 'bg-strong text-body border-hairline',
  LOW: 'bg-soft text-subtle border-hairline',
};

const BLANK_WAREHOUSE = {
  name: '', location: '',
  shippingBaseCost: 0, costPerUnit: 0, deliveryDays: 3,
  priority: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW',
};

function NumField({
  label, suffix, value, onChange, step = 1,
}: {
  label: string; suffix?: string; value: number; onChange: (n: number) => void; step?: number;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-subtle mb-1">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number" min={0} step={step} value={value}
          onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink"
        />
        {suffix && <span className="text-xs text-subtle shrink-0">{suffix}</span>}
      </div>
    </label>
  );
}

function WarehousesTab({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...BLANK_WAREHOUSE });
  const [editing, setEditing] = useState<Record<string, WarehouseRow>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/admin/warehouses'); setRows(r.data.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await api.post('/admin/warehouses', form);
      showToast(`Warehouse "${form.name}" created`);
      setShowForm(false);
      setForm({ ...BLANK_WAREHOUSE });
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? 'Failed', 'error');
    }
  };

  // Drafts are held per row so editing one warehouse never disturbs another.
  const draftFor = (r: WarehouseRow) => editing[r.id] ?? r;
  const edit = (r: WarehouseRow, patch: Partial<WarehouseRow>) =>
    setEditing(d => ({ ...d, [r.id]: { ...draftFor(r), ...patch } }));

  const save = async (r: WarehouseRow) => {
    const draft = draftFor(r);
    setSaving(r.id);
    try {
      await api.put(`/admin/warehouses/${r.id}`, {
        location: draft.location ?? '',
        shippingBaseCost: Number(draft.shippingBaseCost ?? 0),
        costPerUnit: Number(draft.costPerUnit ?? 0),
        deliveryDays: Number(draft.deliveryDays ?? 0),
        priority: draft.priority ?? 'MEDIUM',
      });
      showToast(`${r.name} updated — the planner uses the new figures immediately`);
      setEditing(d => { const next = { ...d }; delete next[r.id]; return next; });
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? 'Failed', 'error');
    } finally { setSaving(null); }
  };

  return (
    <div>
      <SectionHeader title="Warehouses" onAdd={() => setShowForm(v => !v)} addLabel="New Warehouse" />
      <p className="text-sm text-subtle mb-5">
        Shipping cost and lead time here decide which warehouse split the fulfillment engine recommends.
        Priority breaks ties between plans that score identically.
      </p>

      {showForm && (
        <div className="bg-soft border border-hairline rounded-md p-5 mb-5 grid grid-cols-2 gap-3">
          <input placeholder="Warehouse name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />
          <input placeholder="Location (optional)" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />

          <NumField label="Shipping base cost (per shipment)" suffix="₹" value={form.shippingBaseCost}
            onChange={n => setForm(f => ({ ...f, shippingBaseCost: n }))} />
          <NumField label="Cost per unit" suffix="₹" value={form.costPerUnit}
            onChange={n => setForm(f => ({ ...f, costPerUnit: n }))} />
          <NumField label="Delivery lead time" suffix="days" value={form.deliveryDays}
            onChange={n => setForm(f => ({ ...f, deliveryDays: n }))} />

          <label className="block">
            <span className="block text-xs text-subtle mb-1">Priority</span>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as 'HIGH' | 'MEDIUM' | 'LOW' }))}
              className="w-full bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <div className="col-span-2 flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-subtle hover:text-ink">Cancel</button>
            <button onClick={create} className="px-4 py-2 bg-ink hover:bg-ink-active text-white text-sm rounded-lg font-medium">Save</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-10 text-subtle">Loading…</div> : (
        <div className="grid grid-cols-2 gap-4">
          {rows.map(r => {
            const draft = draftFor(r);
            const dirty = editing[r.id] !== undefined;
            return (
              <div key={r.id} className="bg-soft border border-hairline rounded-md p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-ink">{r.name}</p>
                    <p className="text-sm text-subtle mt-0.5">{r.location ?? 'No location set'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_STYLES[draft.priority ?? 'MEDIUM']}`}>
                      {draft.priority ?? 'MEDIUM'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.isActive ? 'bg-success/10 text-success' : 'bg-strong text-subtle'}`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <NumField label="Base cost / shipment" suffix="₹" value={Number(draft.shippingBaseCost ?? 0)}
                    onChange={n => edit(r, { shippingBaseCost: n })} />
                  <NumField label="Cost per unit" suffix="₹" value={Number(draft.costPerUnit ?? 0)}
                    onChange={n => edit(r, { costPerUnit: n })} />
                  <NumField label="Lead time" suffix="days" value={Number(draft.deliveryDays ?? 0)}
                    onChange={n => edit(r, { deliveryDays: n })} />
                  <label className="block">
                    <span className="block text-xs text-subtle mb-1">Priority</span>
                    <select value={draft.priority ?? 'MEDIUM'} onChange={e => edit(r, { priority: e.target.value as 'HIGH' | 'MEDIUM' | 'LOW' })}
                      className="w-full bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink">
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                </div>

                {dirty && (
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => setEditing(d => { const next = { ...d }; delete next[r.id]; return next; })}
                      className="px-3 py-1.5 text-sm text-subtle hover:text-ink"
                    >
                      Discard
                    </button>
                    <button
                      onClick={() => save(r)}
                      disabled={saving === r.id}
                      className="px-3 py-1.5 bg-ink hover:bg-ink-active text-white text-sm rounded-lg font-medium disabled:opacity-50"
                    >
                      {saving === r.id ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Fulfillment Rules Tab ────────────────────────────────────────────────────
//
// The five weights the fulfillment planner scores candidate plans with. This is
// the screen that proves the engine is configurable business logic: push
// shipping cost up and delivery down, re-open an approved quotation, and the
// recommended split changes for the very same order.

const WEIGHT_FIELDS: Array<{ key: keyof FulfillmentWeights; label: string; hint: string }> = [
  { key: 'weightCompleteness',          label: 'Fulfilment completeness', hint: 'How much of the order can actually be sourced' },
  { key: 'weightShippingCost',          label: 'Shipping cost',           hint: 'Total cost across every shipment in the plan' },
  { key: 'weightDeliveryTime',          label: 'Delivery time',           hint: 'When the slowest shipment lands' },
  { key: 'weightShipmentCount',         label: 'Number of shipments',     hint: 'Fewer parcels, less logistics complexity' },
  { key: 'weightInventoryPreservation', label: 'Inventory preservation',  hint: 'Avoid draining a thin warehouse to zero' },
];

interface FulfillmentWeights {
  weightCompleteness: string | number;
  weightShippingCost: string | number;
  weightDeliveryTime: string | number;
  weightShipmentCount: string | number;
  weightInventoryPreservation: string | number;
}

function FulfillmentRulesTab({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [weights, setWeights] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/fulfillment-settings');
      const d = r.data.data as FulfillmentWeights;
      setWeights(Object.fromEntries(WEIGHT_FIELDS.map(f => [f.key, Number(d[f.key])])));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The score is a percentage, so the weights have to add to 100 or scores stop
  // being comparable between configurations. The server rejects anything else.
  const total = weights ? Object.values(weights).reduce((n, v) => n + v, 0) : 0;
  const balanced = Math.abs(total - 100) < 0.01;

  const save = async () => {
    if (!weights) return;
    setSaving(true);
    try {
      await api.put('/admin/fulfillment-settings', weights);
      showToast('Weights updated — new plans are scored with them immediately');
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? 'Failed', 'error');
    } finally { setSaving(false); }
  };

  if (loading || !weights) return <div className="text-center py-10 text-subtle">Loading…</div>;

  return (
    <div>
      <SectionHeader title="Fulfillment Scoring Weights" />
      <p className="text-sm text-subtle mb-5">
        Every candidate warehouse split is scored 0–100 on these five factors and the highest total wins.
        Change a weight and the engine's recommendation changes with it.
 </p>

 <div className="space-y-4 max-w-2xl">
 {WEIGHT_FIELDS.map(f => (
 <div key={f.key} className="bg-soft border border-hairline rounded-md p-4">
 <div className="flex items-center justify-between mb-2">
 <div>
 <p className="text-sm font-medium text-ink">{f.label}</p>
 <p className="text-xs text-subtle mt-0.5">{f.hint}</p>
 </div>
 <span className="text-sm font-bold text-link tabular-nums w-12 text-right">{weights[f.key]}%</span>
 </div>
 <input
 type="range" min={0} max={100} step={1} value={weights[f.key]}
 onChange={e => setWeights(w => ({ ...w!, [f.key]: Number(e.target.value) }))}
 className="w-full accent-ink"
 />
 </div>
 ))}
 </div>

 <div className="flex items-center justify-between max-w-2xl mt-5">
 <p className={`text-sm font-medium ${balanced ? 'text-success' : 'text-warning'}`}>
          Total {total}% {balanced ? '' : '— must add up to 100 before saving'}
 </p>
 <button
 onClick={save}
 disabled={!balanced || saving}
 className="px-4 py-2 bg-ink hover:bg-ink-active text-white text-sm rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed"
 >
 {saving ? 'Saving…' : 'Save weights'}
        </button>
      </div>
    </div>
  );
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────

function InventoryTab({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/admin/inventory'); setRows(r.data.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateQty = async (row: InventoryRow, qty: string) => {
    await api.put('/admin/inventory', {
      productId: row.productId,
      warehouseId: row.warehouseId,
      quantity: parseInt(qty, 10),
    });
    showToast('Inventory updated');
 load();
 };

 return (
 <div>
 <SectionHeader title="Inventory — Stock per Warehouse" />
 <p className="text-sm text-subtle mb-5">These quantities drive the fulfillment engine's warehouse split calculation.</p>

      {loading ? <div className="text-center py-10 text-subtle">Loading…</div> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-subtle text-left">
              <th className="pb-3 pr-4 font-medium">Product</th>
              <th className="pb-3 pr-4 font-medium">SKU</th>
              <th className="pb-3 pr-4 font-medium">Warehouse</th>
              <th className="pb-3 font-medium">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-hairline hover:bg-soft transition">
                <td className="py-3 pr-4 font-medium text-ink">{r.productName}</td>
                <td className="py-3 pr-4 text-subtle font-mono text-xs">{r.productSku ?? '—'}</td>
                <td className="py-3 pr-4 text-body">{r.warehouseName}</td>
                <td className="py-3 text-ink font-semibold">
                  <InlineEdit
                    value={String(r.quantity)}
                    onSave={v => updateQty(r, v)}
                    type="number"
                    min="0"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Plans Tab ────────────────────────────────────────────────────────────────

function PlansTab({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<SubPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', billingCycle: 'MONTHLY', priceMultiplier: '1.0000', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/admin/subscription-plans'); setRows(r.data.data); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await api.post('/admin/subscription-plans', form);
      showToast(`Plan "${form.name}" created`);
      setShowForm(false);
      load();
    } catch (e: any) {
      showToast(e?.response?.data?.error ?? 'Failed', 'error');
    }
  };

  const cycleBadge = (c: string) => {
    const colors: Record<string, string> = {
      MONTHLY: 'bg-link/10 text-link border-link/30',
      QUARTERLY: 'bg-cream text-ink border-hairline',
      YEARLY: 'bg-cream text-ink border-hairline',
    };
    return <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${colors[c] ?? ''}`}>{c}</span>;
  };

  return (
    <div>
      <SectionHeader title="Subscription Plans" onAdd={() => setShowForm(v => !v)} addLabel="New Plan" />

      {showForm && (
        <div className="bg-soft border border-hairline rounded-md p-5 mb-5 grid grid-cols-2 gap-3">
          <input placeholder="Plan name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />
          <select value={form.billingCycle} onChange={e => setForm(f => ({ ...f, billingCycle: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink">
            <option>MONTHLY</option><option>QUARTERLY</option><option>YEARLY</option>
          </select>
          <input placeholder="Price multiplier (e.g. 1.0 = monthly)" value={form.priceMultiplier} onChange={e => setForm(f => ({ ...f, priceMultiplier: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />
          <input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="bg-strong border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink" />
          <div className="col-span-2 flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-subtle hover:text-ink">Cancel</button>
            <button onClick={create} className="px-4 py-2 bg-ink hover:bg-ink-active text-white text-sm rounded-lg font-medium">Save</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-10 text-subtle">Loading…</div> : (
        <div className="grid grid-cols-3 gap-4">
          {rows.map(r => (
            <div key={r.id} className="bg-soft border border-hairline rounded-md p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-ink">{r.name}</p>
                {cycleBadge(r.billingCycle)}
              </div>
              <p className="text-sm text-subtle">{r.description ?? ''}</p>
              <p className="text-xs text-line-strong mt-3">Multiplier: <span className="text-subtle font-mono">{r.priceMultiplier}×</span></p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
