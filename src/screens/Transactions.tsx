import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Plus,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  X,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Transaction, Resident, DocumentType } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { TRANSACTION_STATUSES } from '@/lib/constants';
import { calculateAge, getFullName, formatDate, formatShortDate, formatCurrency } from '@/lib/age';
import { logAudit } from '@/lib/audit';
import { PageHeader, Badge, EmptyState, Modal } from '@/components/ui';
import { ResidentAvatar } from '@/components/ResidentShared';
import { exportToCSV } from '@/lib/export';

const PAGE_SIZE = 25;

const STATUS_COLORS: Record<string, 'slate' | 'blue' | 'yellow' | 'green' | 'red'> = {
  received: 'blue',
  processing: 'yellow',
  ready: 'teal' as 'blue',
  released: 'green',
  cancelled: 'red',
};

interface TransactionWithRelations extends Transaction {
  residents?: { first_name: string; last_name: string; middle_name: string; suffix: string } | null;
  document_types?: { name: string } | null;
}

export function Transactions() {
  const { canEdit, session } = useAuth();
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Form state
  const [residents, setResidents] = useState<Resident[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [residentSearch, setResidentSearch] = useState('');
  const [selectedResident, setSelectedResident] = useState<string>('');
  const [form, setForm] = useState({
    document_type_id: '',
    purpose: '',
    or_number: '',
    fee: 0,
    status: 'received' as Transaction['status'],
    notes: '',
    date_requested: new Date().toISOString().split('T')[0],
  });

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('transactions')
      .select('*, residents!left(first_name, last_name, middle_name, suffix), document_types!left(name)', { count: 'exact' });

    if (search.trim()) {
      query = query.or(`purpose.ilike.%${search}%,or_number.ilike.%${search}%`);
    }
    if (filterStatus) query = query.eq('status', filterStatus);

    const { count: totalCount } = await query;
    setCount(totalCount ?? 0);

    const { data } = await query
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    setTransactions((data ?? []) as TransactionWithRelations[]);
    setLoading(false);
  }, [search, filterStatus, page]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    setPage(0);
  }, [search, filterStatus]);

  useEffect(() => {
    const fetchDocTypes = async () => {
      const { data } = await supabase.from('document_types').select('*').eq('is_active', true).order('display_order');
      if (data) setDocTypes(data as DocumentType[]);
    };
    fetchDocTypes();
  }, []);

  useEffect(() => {
    if (residentSearch.trim().length < 2) {
      setResidents([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('residents')
        .select('*')
        .or(`first_name.ilike.%${residentSearch}%,last_name.ilike.%${residentSearch}%`)
        .neq('verification_status', 'archived')
        .limit(10);
      if (data) setResidents(data as Resident[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [residentSearch]);

  const handleCreate = async () => {
    if (!canEdit()) return;
    const data: Partial<Transaction> = {
      resident_id: selectedResident || null,
      document_type_id: form.document_type_id || null,
      purpose: form.purpose,
      or_number: form.or_number || null,
      fee: form.fee,
      status: form.status,
      notes: form.notes,
      date_requested: form.date_requested,
      processed_by: session?.user.id,
    };

    const { data: newRec, error } = await supabase.from('transactions').insert(data).select().maybeSingle();
    if (!error && newRec) {
      await logAudit('Transaction Created', 'transaction', (newRec as Transaction).id, `Created transaction: ${form.purpose}`);
    }
    setShowModal(false);
    setForm({
      document_type_id: '',
      purpose: '',
      or_number: '',
      fee: 0,
      status: 'received',
      notes: '',
      date_requested: new Date().toISOString().split('T')[0],
    });
    setSelectedResident('');
    setResidentSearch('');
    fetchTransactions();
  };

  const handleStatusChange = async (id: string, status: Transaction['status']) => {
    const update: Partial<Transaction> = { status };
    if (status === 'released') {
      update.released_date = new Date().toISOString().split('T')[0];
    }
    await supabase.from('transactions').update(update).eq('id', id);
    await logAudit('Transaction Updated', 'transaction', id, `Status changed to ${status}`);
    fetchTransactions();
  };

  const handleExport = async () => {
    setExporting(true);
    let query = supabase.from('transactions').select('*, residents!left(first_name, last_name, middle_name, suffix), document_types!left(name)');
    if (search.trim()) query = query.or(`purpose.ilike.%${search}%,or_number.ilike.%${search}%`);
    if (filterStatus) query = query.eq('status', filterStatus);
    const { data } = await query.order('created_at', { ascending: false });
    const rows = (data ?? []) as TransactionWithRelations[];
    exportToCSV(
      rows.map((t) => ({
        Date: formatShortDate(t.date_requested),
        Resident: t.residents ? getFullName(t.residents) : '',
        'Document Type': t.document_types?.name ?? '',
        Purpose: t.purpose,
        Status: t.status,
        'OR Number': t.or_number ?? '',
        Fee: t.fee,
        'Released Date': t.released_date ? formatShortDate(t.released_date) : '',
        Notes: t.notes ?? '',
      })),
      `transactions_${new Date().toISOString().split('T')[0]}`,
    );
    setExporting(false);
  };

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Transactions"
        description={`${count} transaction${count !== 1 ? 's' : ''}`}
        actions={
          <>
            <button className="btn-secondary" onClick={handleExport} disabled={exporting || count === 0}>
              <Download className="h-4 w-4" /> Export
            </button>
            {canEdit() && (
              <button className="btn-primary" onClick={() => setShowModal(true)}>
                <Plus className="h-4 w-4" /> New Transaction
              </button>
            )}
          </>
        }
      />

      <div className="card p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Search by purpose or OR number..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
            />
          </div>
          <select className="select sm:w-40" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {TRANSACTION_STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" /></div>
      ) : transactions.length === 0 ? (
        <div className="card"><EmptyState icon={Receipt} title="No transactions found" /></div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Resident</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase hidden md:table-cell">Document</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase hidden lg:table-cell">OR Number</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Fee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-700">{formatShortDate(t.date_requested)}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-800">
                          {t.residents ? getFullName(t.residents) : '—'}
                        </p>
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">{t.purpose}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 hidden md:table-cell">
                        {t.document_types?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 hidden lg:table-cell">
                        {t.or_number ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {t.fee > 0 ? formatCurrency(t.fee) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {canEdit() ? (
                          <select
                            className="select !py-1 !text-xs w-28"
                            value={t.status}
                            onChange={(e) => handleStatusChange(t.id, e.target.value as Transaction['status'])}
                          >
                            {TRANSACTION_STATUSES.map((s) => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge color={STATUS_COLORS[t.status] ?? 'slate'}>{t.status}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">Page {page + 1} of {totalPages}</p>
              <div className="flex gap-2">
                <button className="btn-secondary !px-3" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button className="btn-secondary !px-3" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* New Transaction Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="New Transaction"
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreate}>
              <Save className="h-4 w-4" /> Create Transaction
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Resident search */}
          <div>
            <label className="label">Resident</label>
            {selectedResident ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                <span className="text-sm font-medium text-blue-900">
                  {(() => {
                    const r = residents.find((r) => r.id === selectedResident);
                    return r ? getFullName(r) : 'Selected';
                  })()}
                </span>
                <button onClick={() => { setSelectedResident(''); setResidentSearch(''); }} className="text-blue-600 hover:text-blue-800">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input pl-10"
                    placeholder="Search resident by name..."
                    value={residentSearch}
                    onChange={(e) => setResidentSearch(e.target.value)}
                  />
                </div>
                {residents.length > 0 && (
                  <div className="mt-2 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                    {residents.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setSelectedResident(r.id); setResidentSearch(''); setResidents([]); }}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 text-left transition-colors"
                      >
                        <ResidentAvatar r={r} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{getFullName(r)}</p>
                          <p className="text-xs text-slate-500">{r.purok ?? ''} {r.village ?? ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Document Type</label>
              <select className="select" value={form.document_type_id} onChange={(e) => {
                const dt = docTypes.find((d) => d.id === e.target.value);
                setForm({ ...form, document_type_id: e.target.value, fee: dt?.default_fee ?? 0 });
              }}>
                <option value="">Select...</option>
                {docTypes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date Requested</label>
              <input type="date" className="input" value={form.date_requested} onChange={(e) => setForm({ ...form, date_requested: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Purpose</label>
            <input className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g., Employment requirement" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">OR Number (optional)</label>
              <input className="input" value={form.or_number} onChange={(e) => setForm({ ...form, or_number: e.target.value })} />
            </div>
            <div>
              <label className="label">Fee (PHP)</label>
              <input type="number" className="input" value={form.fee} onChange={(e) => setForm({ ...form, fee: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Transaction['status'] })}>
                {TRANSACTION_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
