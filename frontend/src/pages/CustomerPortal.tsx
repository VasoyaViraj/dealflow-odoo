import { useState, useEffect, useCallback } from 'react';
import AppShell from '../components/layout/AppShell';
import api from '../lib/api';
import type { Quotation } from '../types/quotation';
import { Toast } from '../components/ui/Toast';
import { PortalQuotationList } from '../components/portal/PortalQuotationList';
import { PortalQuotationDetail } from '../components/portal/PortalQuotationDetail';

export default function CustomerPortal() {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadList = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      // Customers can only see non-DRAFT quotations (enforced by backend)
      const r = await api.get('/quotations', { params: { limit: 12, page } });
      setQuotations((r.data.data as Quotation[]).filter(q => q.status !== 'DRAFT'));
      if (r.data.pagination) {
        setTotalPages(r.data.pagination.pages || 1);
        setCurrentPage(r.data.pagination.page || 1);
      }
    } catch { showToast('Failed to load quotations', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadList(1); }, [loadList]);

  const openDetail = async (q: Quotation) => {
    try {
      const r = await api.get(`/quotations/${q.id}`);
      setSelected(r.data.data);
      setView('detail');
    } catch { showToast('Failed to load quotation details', 'error'); }
  };

  return (
    <AppShell>
      {view === 'list' ? (
        <PortalQuotationList 
          quotations={quotations} 
          loading={loading} 
          onOpen={openDetail} 
          onRefresh={() => loadList(currentPage)} 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={loadList}
        />
      ) : selected ? (
        <PortalQuotationDetail
          quotation={selected}
          onBack={() => { setView('list'); setSelected(null); }}
          showToast={showToast}
        />
      ) : null}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </AppShell>
  );
}
