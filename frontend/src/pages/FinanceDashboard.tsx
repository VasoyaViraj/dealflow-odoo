import AppShell from '../components/layout/AppShell';
import { DollarSign } from 'lucide-react';

export default function FinanceDashboard() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Finance & Operations</h1>
          <p className="text-zinc-400 text-sm mt-1">High-value approvals, billing, invoices, and payments.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
            <DollarSign size={28} className="text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-200">Billing Engine — Phase 6</h2>
          <p className="text-zinc-500 text-sm mt-2 max-w-sm">
            Hybrid billing (one-time + subscription), invoices, payment tracking, and finance approvals are built in Phase 6.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
