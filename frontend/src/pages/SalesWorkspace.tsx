import AppShell from '../components/layout/AppShell';
import { ShoppingCart, Plus } from 'lucide-react';

export default function SalesWorkspace() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Sales Workspace</h1>
            <p className="text-zinc-400 text-sm mt-1">Create and manage your quotations.</p>
          </div>
          {/* Phase 3 will wire this button to the quotation engine */}
          <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 text-zinc-500 text-sm px-4 py-2 rounded-lg cursor-not-allowed select-none" title="Available in Phase 3">
            <Plus size={15} />
            New Quotation
            <span className="text-xs bg-zinc-700 text-zinc-500 px-1.5 py-0.5 rounded ml-1">Phase 3</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
            <ShoppingCart size={28} className="text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-200">Quotation Engine — Phase 3</h2>
          <p className="text-zinc-500 text-sm mt-2 max-w-sm">
            The full quotation workspace with product selection, discount application, margin calculation and upsell suggestions is being built in Phase 3.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
