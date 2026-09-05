/**
 * FulfillmentWorkspace — the operations view of the fulfillment engine.
 *
 * Left: every approved quotation, split into those still awaiting a split
 * decision and those already confirmed (a backordered one stays visible because
 * it still needs someone to consolidate it). Right: the selected quotation's
 * FulfillmentPanel, which is the same component the rep sees in their
 * workspace — one screen, one behaviour, no second implementation to drift.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import FulfillmentPanel from '../components/fulfillment/FulfillmentPanel';
import api from '../lib/api';
import { AlertTriangle, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import type { FulfillmentListItem } from '../types/fulfillment';

interface ApprovedQuotation {
  id: string;
  quotationNumber: string;
  status: string;
  grandTotal: string;
  createdAt: string;
  customer?: { name?: string };
  customerName?: string;
}

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

export default function FulfillmentWorkspace() {
  const [quotations, setQuotations] = useState<ApprovedQuotation[]>([]);
  const [orders, setOrders] = useState<FulfillmentListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [q, f] = await Promise.all([
        api.get('/quotations', { params: { status: 'APPROVED', limit: 100 } }),
        api.get('/fulfillment', { params: { limit: 100 } }),
      ]);
      setQuotations(q.data.data);
      setOrders(f.data.data);
      setSelectedId((current) => current ?? q.data.data[0]?.id ?? null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const orderByQuotation = useMemo(
    () => new Map(orders.map((o) => [o.quotationId, o])),
    [orders],
  );

  const pending = quotations.filter((q) => !orderByQuotation.has(q.id));
  const backordered = quotations.filter((q) => orderByQuotation.get(q.id)?.status === 'BACKORDERED');
  const done = quotations.filter((q) => orderByQuotation.get(q.id)?.status === 'FULFILLED');

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  const nameOf = (q: ApprovedQuotation) =>
    q.customer?.name ?? q.customerName ?? orderByQuotation.get(q.id)?.customerName ?? '—';

  const card = (q: ApprovedQuotation) => {
    const order = orderByQuotation.get(q.id);
    const selected = q.id === selectedId;
    return (
      <button
        key={q.id}
        onClick={() => setSelectedId(q.id)}
        className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
          selected
            ? 'bg-violet-600/15 border-violet-500/40'
            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-zinc-100">{q.quotationNumber}</span>
          {order ? (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              order.status === 'FULFILLED'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}>
              {order.status === 'FULFILLED' ? 'Fulfilled' : 'Backorder'}
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-violet-500/15 text-violet-300 border-violet-500/30">
              Awaiting split
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-400 mt-1 truncate">{nameOf(q)}</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {fmt(q.grandTotal)}
          {order && ` · ${order.shipmentCount} shipment${order.shipmentCount === 1 ? '' : 's'} · ${fmt(order.totalShippingCost)}`}
        </p>
      </button>
    );
  };

  const section = (title: string, icon: React.ReactNode, items: ApprovedQuotation[]) =>
    items.length > 0 && (
      <div>
        <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          {icon} {title} ({items.length})
        </p>
        <div className="space-y-2">{items.map(card)}</div>
      </div>
    );

  return (
    <AppShell>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Fulfillment</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Warehouse splits for approved deals.{' '}
              <span className="text-violet-400 font-medium">{pending.length} awaiting a decision</span>
              {backordered.length > 0 && (
                <>, <span className="text-amber-400 font-medium">{backordered.length} on backorder</span></>
              )}
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
            Loading approved deals…
          </div>
        ) : quotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
              <Truck size={28} className="text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-200">Nothing to fulfil yet</h2>
            <p className="text-zinc-500 text-sm mt-2 max-w-sm">
              A quotation appears here as soon as it reaches Approved.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[300px_1fr] gap-6 items-start">
            <div className="space-y-5">
              {section('Awaiting split', <Truck size={11} />, pending)}
              {section('On backorder', <AlertTriangle size={11} className="text-amber-400" />, backordered)}
              {section('Fulfilled', <PackageCheck size={11} className="text-emerald-400" />, done)}
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              {selectedId ? (
                <FulfillmentPanel key={selectedId} quotationId={selectedId} canConfirm onChanged={load} />
              ) : (
                <p className="text-sm text-zinc-500 text-center py-20">Select a quotation to plan its fulfillment.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
