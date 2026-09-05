import { CheckCircle, AlertTriangle } from 'lucide-react';

export function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  /* Toasts are the one place the system leans on a dark surface at small size:
     ink for a confirmation, coral for a failure. No colour-tinted glow. */
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-lg text-sm font-medium text-white shadow-lg ${
        type === 'success' ? 'bg-ink' : 'bg-coral'
      }`}
    >
      {type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      {msg}
    </div>
  );
}
