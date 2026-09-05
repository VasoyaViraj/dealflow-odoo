import AppShell from '../components/layout/AppShell';
import { Globe } from 'lucide-react';

export default function CustomerPortal() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Customer Portal</h1>
          <p className="text-zinc-400 text-sm mt-1">View quotations, negotiate terms, and confirm orders.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-4">
            <Globe size={28} className="text-sky-400" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-200">Customer Portal — Phase 7</h2>
          <p className="text-zinc-500 text-sm mt-2 max-w-sm">
            The restricted customer portal with quotation viewing, discount counter-offers, negotiation, and order confirmation is built in Phase 7.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
