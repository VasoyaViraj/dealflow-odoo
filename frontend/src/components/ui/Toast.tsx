import { CheckCircle, AlertTriangle } from 'lucide-react';

export function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium border
      ${type === 'success' ? 'bg-emerald-900/80 text-emerald-300 border-emerald-500/30' : 'bg-red-900/80 text-red-300 border-red-500/30'}`}>
      {type === 'success' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
      {msg}
    </div>
  );
}
