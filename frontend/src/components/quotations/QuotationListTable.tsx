import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { TableSkeleton } from '../ui/Skeleton';

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
  loading?: boolean;
}

export function statusColor(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'bg-line-strong text-body border-hairline',
    SUBMITTED: 'bg-link/10 text-link border-link/30',
    PENDING_MANAGER: 'bg-mustard/20 text-warning border-mustard/60',
    PENDING_FINANCE: 'bg-coral/8 text-coral border-coral/30',
    APPROVED: 'bg-success/10 text-success border-success/30',
    REJECTED: 'bg-coral/8 text-coral border-coral/30',
    REVISION_REQUESTED: 'bg-cream text-ink border-hairline',
    CANCELLED: 'bg-strong text-subtle border-hairline',
    EXPIRED: 'bg-strong text-subtle border-hairline',
  };
  return map[status] || 'bg-line-strong text-body border-hairline';
}

export function formatCurrency(amount: number | string) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
}

export default function QuotationListTable({ quotations, basePath, hideCustomer = false, loading = false }: Props) {
  if (loading && quotations.length === 0) {
    return <TableSkeleton rows={5} columns={hideCustomer ? 4 : 5} />;
  }

  if (quotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-canvas border border-hairline rounded-md">
        <div className="w-12 h-12 rounded-md bg-soft flex items-center justify-center mb-3">
          <FileText size={20} className="text-subtle" />
        </div>
        <p className="text-subtle text-sm">No quotations found.</p>
      </div>
    );
  }

  return (
    <div className="bg-canvas border border-hairline rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-subtle text-left bg-soft">
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
              <tr key={q.id} className="border-b border-hairline hover:bg-soft transition group">
                <td className="px-5 py-3 font-medium text-ink">
                  <Link to={`${basePath}/${q.id}`} className="text-link hover:text-link-active">
                    {q.quotationNumber || 'Pending'}
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${statusColor(q.status)}`}>
                    {q.status.replace('_', ' ')}
                  </span>
                </td>
                {!hideCustomer && (
                  <td className="px-5 py-3 text-body">{customerName}</td>
                )}
                <td className="px-5 py-3 text-ink text-right font-medium">
                  {formatCurrency(q.grandTotal)}
                </td>
                <td className="px-5 py-3 text-subtle text-right">
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
