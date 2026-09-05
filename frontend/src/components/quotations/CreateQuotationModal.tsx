import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { X } from 'lucide-react';
import type { Customer, Quotation } from '../../types/quotation';

export function CreateQuotationModal({
  onClose,
  onCreated,
  showToast,
}: {
  onClose: () => void;
  onCreated: (q: Quotation) => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.get('/customers').then(r => setCustomers(r.data.data)).finally(() => setFetching(false));
  }, []);

  const create = async () => {
    if (!customerId) { showToast('Select a customer', 'error'); return; }
    setLoading(true);
    try {
      const r = await api.post('/quotations', { customerId, notes: notes.trim() || undefined });
      onCreated(r.data.data);
    } catch (e: any) {
      showToast(e?.response?.data?.error?.message ?? e?.response?.data?.error ?? 'Failed to create quotation', 'error');
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white">New Quotation</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition"><X size={18} /></button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5 font-medium">Customer *</label>
              {fetching ? (
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-500">Loading customers…</div>
              ) : (
                <select
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 transition"
                >
                  <option value="">— Select a customer —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.tier})</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5 font-medium">Notes <span className="text-zinc-600">(optional)</span></label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Internal notes for this quotation…"
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 resize-none transition"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-600 transition">Cancel</button>
            <button
              id="create-quotation-submit"
              onClick={create}
              disabled={loading || !customerId}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : 'Create Quotation'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
