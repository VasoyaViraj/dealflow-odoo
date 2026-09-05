import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, RefreshCw, Send, AlertCircle } from 'lucide-react';
import api from '../../lib/api';
import { getProducts } from '../../lib/referenceData';
import { statusColor, formatCurrency } from './QuotationListTable';

interface Product {
  id: string;
  name: string;
  sku: string | null;
}

interface Props {
  quotationId: string;
  onBack: () => void;
  renderSidePanel?: (quotation: any, reload: () => void) => React.ReactNode;
  canEdit?: boolean;
}

export default function QuotationDetailView({ quotationId, onBack, renderSidePanel, canEdit = false }: Props) {
  const [quotation, setQuotation] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For adding a new line
  const [newProductId, setNewProductId] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newDiscount, setNewDiscount] = useState(0);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [qRes, pRes] = await Promise.all([
        api.get(`/quotations/${quotationId}`),
        canEdit ? getProducts() : Promise.resolve([])
      ]);
      setQuotation(qRes.data.data);
      if (canEdit) setProducts(pRes);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load quotation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [quotationId, canEdit]);

  const handleUpdateQuotationDiscount = async (pct: string) => {
    try {
      const res = await api.patch(`/quotations/${quotationId}`, {
        quotationDiscountPercent: parseFloat(pct) || 0,
        expectedVersion: quotation.version
      });
      setQuotation(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Update failed');
    }
  };

  const handleAddLine = async () => {
    if (!newProductId) return;
    try {
      const res = await api.post(`/quotations/${quotationId}/items`, {
        productId: newProductId,
        quantity: newQuantity,
        discountPercent: newDiscount,
        expectedVersion: quotation.version
      });
      setQuotation(res.data.data);
      setNewProductId('');
      setNewQuantity(1);
      setNewDiscount(0);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to add line');
    }
  };

  const handleUpdateLine = async (itemId: string, field: 'quantity' | 'discountPercent', value: string) => {
    try {
      const res = await api.patch(`/quotations/${quotationId}/items/${itemId}`, {
        [field]: parseFloat(value) || 0,
        expectedVersion: quotation.version
      });
      setQuotation(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update line');
    }
  };

  const handleDeleteLine = async (itemId: string) => {
    try {
      const res = await api.delete(`/quotations/${quotationId}/items/${itemId}?expectedVersion=${quotation.version}`);
      setQuotation(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to delete line');
    }
  };

  const handleRecalculate = async () => {
    try {
      const res = await api.post(`/quotations/${quotationId}/recalculate`);
      setQuotation(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Recalculation failed');
    }
  };

  const handleSubmit = async () => {
    try {
      const res = await api.post(`/quotations/${quotationId}/submit`, { expectedVersion: quotation.version });
      setQuotation(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Submit failed');
    }
  };

  if (loading) return <div className="text-subtle text-center py-12">Loading quotation...</div>;
  if (!quotation) return <div className="text-coral text-center py-12">{error}</div>;

  const isDraft = quotation.status === 'DRAFT';
  const editable = canEdit && isDraft;

  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pr-2 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-soft rounded-lg text-subtle hover:text-ink transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-ink">{quotation.quotationNumber || 'Draft Quotation'}</h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border ${statusColor(quotation.status)}`}>
                {quotation.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-subtle mt-1">
              Customer: <span className="font-medium text-ink">{quotation.customer?.name}</span>
            </p>
          </div>
          
          <div className="ml-auto flex items-center gap-2">
            {editable && (
              <>
                <button onClick={handleRecalculate} className="flex items-center gap-2 px-3 py-2 bg-soft hover:bg-strong text-body text-sm font-medium rounded-lg transition">
                  <RefreshCw size={14} /> Recalculate
                </button>
                <button onClick={handleSubmit} className="flex items-center gap-2 px-4 py-2 bg-ink hover:bg-ink-active text-white text-sm font-medium rounded-lg transition shadow-lg">
                  <Send size={14} /> Submit
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-coral/8 border border-coral/30 rounded-md flex items-center gap-3 text-coral text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Lines Table */}
        <div className="bg-canvas border border-hairline rounded-md overflow-hidden mb-6">
          <div className="p-4 border-b border-hairline bg-soft flex justify-between items-center">
            <h3 className="font-semibold text-ink">Line Items</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-subtle text-left bg-soft">
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Unit Price</th>
                <th className="px-4 py-2 text-right">Discount %</th>
                <th className="px-4 py-2 text-right">Net Price</th>
                <th className="px-4 py-2 text-right">Line Total</th>
                {editable && <th className="px-4 py-2 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {quotation.lines?.map((line: any) => (
                <tr key={line.id} className="border-b border-hairline hover:bg-soft">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{line.productName}</div>
                    <div className="text-xs text-subtle font-mono">{line.productSku}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editable ? (
                      <input type="number" min="1" value={line.quantity} onChange={(e) => handleUpdateLine(line.id, 'quantity', e.target.value)}
                        className="w-16 bg-soft border border-hairline rounded px-2 py-1 text-right text-ink focus:outline-none focus:border-ink" />
                    ) : line.quantity}
                  </td>
                  <td className="px-4 py-3 text-right text-subtle">{formatCurrency(line.unitPrice)}</td>
                  <td className="px-4 py-3 text-right">
                    {editable ? (
                      <input type="number" min="0" max="100" value={line.discountPercent} onChange={(e) => handleUpdateLine(line.id, 'discountPercent', e.target.value)}
                        className="w-16 bg-soft border border-hairline rounded px-2 py-1 text-right text-ink focus:outline-none focus:border-ink" />
                    ) : `${line.discountPercent}%`}
                    {line.isOverDiscountLimit && (
                      <span title={`Exceeds limit by ${line.discountOverLimitPercent}%`} className="text-coral ml-1 inline-block"><AlertCircle size={12} /></span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-body">{formatCurrency(line.netAmount)}</td>
                  <td className="px-4 py-3 text-right font-medium text-ink">{formatCurrency(line.lineTotal)}</td>
                  {editable && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDeleteLine(line.id)} className="text-subtle hover:text-coral transition">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {quotation.lines?.length === 0 && (
                <tr>
                  <td colSpan={editable ? 7 : 6} className="px-4 py-8 text-center text-subtle">
                    No items in this quotation yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Add Line Form */}
          {editable && (
            <div className="p-4 bg-soft flex items-center gap-3 border-t border-hairline">
              <select 
                value={newProductId} 
                onChange={e => setNewProductId(e.target.value)}
                className="flex-1 bg-soft border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink"
              >
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
                ))}
              </select>
              <input 
                type="number" min="1" placeholder="Qty" value={newQuantity} onChange={e => setNewQuantity(parseInt(e.target.value) || 1)}
                className="w-20 bg-soft border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink"
              />
              <input 
                type="number" min="0" max="100" placeholder="Disc %" value={newDiscount} onChange={e => setNewDiscount(parseFloat(e.target.value) || 0)}
                className="w-24 bg-soft border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink"
              />
              <button 
                onClick={handleAddLine} 
                disabled={!newProductId}
                className="flex items-center gap-1.5 px-4 py-2 bg-soft hover:bg-strong text-ink text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                <Plus size={16} /> Add
              </button>
            </div>
          )}
        </div>

        {/* Summary Totals */}
        <div className="flex justify-end">
          <div className="w-80 bg-canvas border border-hairline rounded-md p-5">
            <div className="flex justify-between items-center mb-3 text-sm text-subtle">
              <span>Subtotal</span>
              <span>{formatCurrency(quotation.subtotal)}</span>
            </div>
            
            <div className="flex justify-between items-center mb-3 text-sm">
              <span className="text-subtle flex items-center gap-2">
                Overall Discount
                {editable ? (
                  <input 
                    type="number" min="0" max="100" 
                    value={quotation.quotationDiscountPercent} 
                    onChange={e => handleUpdateQuotationDiscount(e.target.value)}
                    className="w-14 bg-soft border border-hairline rounded px-1.5 py-0.5 text-right focus:outline-none focus:border-ink text-ink"
                  />
                ) : (
                  <span className="text-ink">{quotation.quotationDiscountPercent}%</span>
                )}
              </span>
              <span className="text-coral">-{formatCurrency(quotation.discountAmount)}</span>
            </div>
            
            <div className="flex justify-between items-center mb-4 text-sm text-subtle">
              <span>Tax Amount</span>
              <span>{formatCurrency(quotation.taxAmount)}</span>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t border-hairline text-lg font-bold text-ink">
              <span>Grand Total</span>
              <span>{formatCurrency(quotation.grandTotal)}</span>
            </div>
            
            {quotation.margin !== undefined && (
              <div className="mt-4 pt-4 border-t border-hairline">
                <div className="flex justify-between items-center text-xs text-subtle mb-1">
                  <span>Margin Amount</span>
                  <span>{formatCurrency(quotation.margin)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-subtle">
                  <span>Margin %</span>
                  <span className={quotation.marginPercent < 20 ? 'text-coral' : 'text-success'}>
                    {quotation.marginPercent}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Side Panel (e.g., Approval Workflow) */}
      {renderSidePanel && (
        <div className="w-80 shrink-0">
          {renderSidePanel(quotation, loadData)}
        </div>
      )}
    </div>
  );
}
