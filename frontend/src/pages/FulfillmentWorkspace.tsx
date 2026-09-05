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
import Loader from '../components/ui/Loader';
import Pagination from '../components/ui/Pagination';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (page = 1) => {
    try {
      const [q, f] = await Promise.all([
        api.get('/quotations', { params: { status: 'APPROVED', limit: 20, page } }),
        api.get('/fulfillment', { params: { limit: 100 } }),
      ]);
      setQuotations(q.data.data);
      setOrders(f.data.data);
      setSelectedId((current) => current ?? q.data.data[0]?.id ?? null);
      if (q.data.pagination) {
        setTotalPages(q.data.pagination.pages || 1);
        setCurrentPage(q.data.pagination.page || 1);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const orderByQuotation = useMemo(
    () => new Map(orders.map((o) => [o.quotationId, o])),
    [orders],
  );

  const pending = quotations.filter((q) => !orderByQuotation.has(q.id));
  const backordered = quotations.filter((q) => orderByQuotation.get(q.id)?.status === 'BACKORDERED');
  const done = quotations.filter((q) => orderByQuotation.get(q.id)?.status === 'FULFILLED');

  const refresh = () => {
    setRefreshing(true);
    load(currentPage);
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
 className={`w-full text-left rounded-md border px-4 py-3 transition-all ${
 selected
 ? 'bg-cream border-ink'
            : 'bg-canvas border-hairline hover:border-line-strong'
 }`}
 >
 <div className="flex items-center justify-between gap-2">
 <span className="text-sm font-semibold text-ink">{q.quotationNumber}</span>
 {order ? (
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
 order.status === 'FULFILLED'
                ? 'bg-success/10 text-success border-success/30'
                : 'bg-mustard/20 text-warning border-mustard/60'
            }`}>
              {order.status === 'FULFILLED' ? 'Fulfilled' : 'Backorder'}
 </span>
 ) : (
 <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-cream text-ink border-hairline">
 Awaiting split
 </span>
 )}
 </div>
 <p className="text-xs text-subtle mt-1 truncate">{nameOf(q)}</p>
 <p className="text-xs text-subtle mt-0.5">
 {fmt(q.grandTotal)}
 {order && ` · ${order.shipmentCount} shipment${order.shipmentCount === 1 ? '' : 's'} · ${fmt(order.totalShippingCost)}`}
 </p>
 </button>
 );
 };

 const section = (title: string, icon: React.ReactNode, items: ApprovedQuotation[]) =>
 items.length > 0 && (
 <div>
 <p className="text-[11px] text-subtle font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
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
 <h1 className="text-2xl font-bold text-ink">Fulfillment</h1>
 <p className="text-subtle text-sm mt-1">
 Warehouse splits for approved deals.{' '}
 <span className="text-link font-medium">{pending.length} awaiting a decision</span>
 {backordered.length > 0 && (
 <>, <span className="text-warning font-medium">{backordered.length} on backorder</span></>
 )}
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
  ) : quotations.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-32 text-center">
 <div className="w-16 h-16 rounded-lg bg-cream border border-hairline flex items-center justify-center mb-4">
 <Truck size={28} className="text-link" />
 </div>
 <h2 className="text-lg font-semibold text-ink">Nothing to fulfil yet</h2>
 <p className="text-subtle text-sm mt-2 max-w-sm">
 A quotation appears here as soon as it reaches Approved.
 </p>
 </div>
 ) : (
  <div className="grid grid-cols-[300px_1fr] gap-6 items-start">
  <div className="space-y-5">
    {section('Awaiting split', <Truck size={11} />, pending)}
    {section('On backorder', <AlertTriangle size={11} className="text-warning" />, backordered)}
    {section('Fulfilled', <PackageCheck size={11} className="text-success" />, done)}
    
    {!loading && quotations.length > 0 && (
      <div className="mt-4">
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={load} />
      </div>
    )}
  </div>

            <div className="rounded-lg border border-hairline bg-soft p-6">
              {selectedId ? (
                <FulfillmentPanel key={selectedId} quotationId={selectedId} canConfirm onChanged={load} />
              ) : (
                <p className="text-sm text-subtle text-center py-20">Select a quotation to plan its fulfillment.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
