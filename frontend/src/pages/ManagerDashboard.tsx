import AppShell from '../components/layout/AppShell';
import { CheckSquare } from 'lucide-react';

export default function ManagerDashboard() {
  return (
    <AppShell>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Manager Approvals</h1>
          <p className="text-zinc-400 text-sm mt-1">Review and act on quotations that require your approval.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <CheckSquare size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-200">Approval Engine — Phase 4</h2>
          <p className="text-zinc-500 text-sm mt-2 max-w-sm">
            The discount risk engine, approval routing, and approval/reject/return workflow are built in Phase 4.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
