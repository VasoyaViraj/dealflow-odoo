import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

interface QuotationRow {
  id: string;
  quotationNumber: string;
  status: string;
  customer?: { name: string };
  customerName?: string; // from approval queue
  grandTotal: number | string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  quotations: QuotationRow[];
  basePath: string; // e.g., '/sales/quotations' or '/manager/quotations'
  hideCustomer?: boolean;
}

export function statusColor(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
    SUBMITTED: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    PENDING_MANAGER: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    PENDING_FINANCE: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    REJECTED: 'bg-red-500/20 text-red-300 border-red-500/30',
    REVISION_REQUESTED: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    CANCELLED: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/50',
    EXPIRED: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/50',
  };
  return map[status] || 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
}

export function formatCurrency(amount: number | string) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
}

export default function QuotationListTable({ quotations, basePath, hideCustomer = false }: Props) {
  if (quotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center mb-3">
          <FileText size={20} className="text-zinc-500" />
        </div>
        <p className="text-zinc-400 text-sm">No quotations found.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500 text-left bg-zinc-950/50">
            <th className="px-5 py-3 font-medium">Quotation #</th>
            <th className="px-5 py-3 font-medium">Status</th>
            {!hideCustomer && <th className="px-5 py-3 font-medium">Customer</th>}
            <th className="px-5 py-3 font-medium text-right">Grand Total</th>
            <th className="px-5 py-3 font-medium text-right">Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {quotations.map((q) => {
            const customerName = q.customer?.name || q.customerName || 'Unknown Customer';
            return (
              <tr key={q.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition group">
                <td className="px-5 py-3 font-medium text-zinc-100">
                  <Link to={`${basePath}/${q.id}`} className="text-violet-400 hover:text-violet-300">
                    {q.quotationNumber || 'Pending'}
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${statusColor(q.status)}`}>
                    {q.status.replace('_', ' ')}
                  </span>
                </td>
                {!hideCustomer && (
                  <td className="px-5 py-3 text-zinc-300">{customerName}</td>
                )}
                <td className="px-5 py-3 text-zinc-200 text-right font-medium">
                  {formatCurrency(q.grandTotal)}
                </td>
                <td className="px-5 py-3 text-zinc-400 text-right">
                  {new Date(q.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
