import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Plus,
  Home,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Pencil,
  Users,
  MapPin,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Household, Resident } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { navigate } from '@/lib/router';
import { calculateAge, getFullName, formatDate } from '@/lib/age';
import { PUROKS, VILLAGES, RELATIONSHIPS } from '@/lib/constants';
import { logAudit } from '@/lib/audit';
import { PageHeader, Badge, EmptyState, Modal } from '@/components/ui';
import { ResidentAvatar } from '@/components/ResidentShared';

const PAGE_SIZE = 25;

interface HouseholdWithCount extends Household {
  member_count?: number;
  head_name?: string | null;
}

export function Households({ routeParams }: { routeParams: Record<string, string> }) {
  const { canEdit } = useAuth();

  // If ID is provided, show household profile
  if (routeParams.id && routeParams.id !== 'new') {
    return <HouseholdProfile householdId={routeParams.id} />;
  }
  if (routeParams.id === 'new') {
    return <HouseholdForm onDone={() => navigate('households')} />;
  }

  return <HouseholdsList />;
}

function HouseholdsList() {
  const { canEdit } = useAuth();
  const [households, setHouseholds] = useState<HouseholdWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterPurok, setFilterPurok] = useState('');
  const [filterVillage, setFilterVillage] = useState('');

  const fetchHouseholds = useCallback(async () => {
    setLoading(true);

    let query = supabase.from('households').select('*', { count: 'exact' });

    if (search.trim()) {
      query = query.or(
        `complete_address.ilike.%${search}%,household_id_display.ilike.%${search}%,source_household_id.ilike.%${search}%`,
      );
    }
    if (filterPurok) query = query.eq('purok', filterPurok);
    if (filterVillage) query = query.eq('village', filterVillage);

    const { count: totalCount } = await query;
    setCount(totalCount ?? 0);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (error) {
      console.error(error);
    }

    // Fetch member counts and head names
    const hhIds = (data ?? []).map((h) => h.id);
    if (hhIds.length > 0) {
      const { data: residents } = await supabase
        .from('residents')
        .select('id, household_id, first_name, last_name, middle_name, suffix, relationship_to_head')
        .in('household_id', hhIds)
        .neq('verification_status', 'archived');

      const countMap: Record<string, number> = {};
      const headMap: Record<string, string | null> = {};

      (residents ?? []).forEach((r) => {
        if (r.household_id) {
          countMap[r.household_id] = (countMap[r.household_id] ?? 0) + 1;
          if (r.relationship_to_head === 'head') {
            headMap[r.household_id] = getFullName(r);
          }
        }
      });

      (data ?? []).forEach((h) => {
        (h as HouseholdWithCount).member_count = countMap[h.id] ?? 0;
        (h as HouseholdWithCount).head_name = headMap[h.id] ?? null;
      });
    }

    setHouseholds((data ?? []) as HouseholdWithCount[]);
    setLoading(false);
  }, [search, filterPurok, filterVillage, page]);

  useEffect(() => {
    fetchHouseholds();
  }, [fetchHouseholds]);

  useEffect(() => {
    setPage(0);
  }, [search, filterPurok, filterVillage]);

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Households"
        description={`${count} household${count !== 1 ? 's' : ''} registered`}
        actions={
          canEdit() && (
            <button className="btn-primary" onClick={() => navigate('households', { id: 'new' })}>
              <Plus className="h-4 w-4" /> Add Household
            </button>
          )
        }
      />

      <div className="card p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Search by address or household ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
            />
          </div>
          <select className="select sm:w-40" value={filterPurok} onChange={(e) => setFilterPurok(e.target.value)}>
            <option value="">All Puroks</option>
            {PUROKS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="select sm:w-48" value={filterVillage} onChange={(e) => setFilterVillage(e.target.value)}>
            <option value="">All Villages</option>
            {VILLAGES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
        </div>
      ) : households.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Home}
            title="No households found"
            description="Try adjusting your search or add a new household."
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {households.map((h) => (
              <button
                key={h.id}
                onClick={() => navigate('households', { id: h.id })}
                className="card p-5 text-left hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <Home className="h-5 w-5 text-blue-600" />
                  </div>
                  <Badge color="slate">{h.member_count ?? 0} members</Badge>
                </div>
                <h3 className="text-sm font-bold text-slate-800 truncate">
                  {h.head_name ?? 'No Head Assigned'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 truncate">{h.complete_address || 'No address'}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  {h.purok && <Badge color="blue">{h.purok}</Badge>}
                  {h.village && <span className="truncate">{h.village}</span>}
                </div>
                {h.household_id_display && (
                  <p className="mt-2 text-xs text-slate-400">ID: {h.household_id_display}</p>
                )}
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">Page {page + 1} of {totalPages}</p>
              <div className="flex items-center gap-2">
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
    </div>
  );
}

function HouseholdProfile({ householdId }: { householdId: string }) {
  const { canEdit } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: h } = await supabase.from('households').select('*').eq('id', householdId).maybeSingle();
    if (h) setHousehold(h as Household);

    const { data: m } = await supabase
      .from('residents')
      .select('*')
      .eq('household_id', householdId)
      .neq('verification_status', 'archived')
      .order('relationship_to_head');
    if (m) setMembers(m as Resident[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [householdId]);

  if (loading) {
    return <div className="p-6 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (!household) {
    return (
      <div className="p-6">
        <div className="card"><EmptyState icon={Home} title="Household not found" /></div>
      </div>
    );
  }

  const head = members.find((m) => m.relationship_to_head === 'head');

  if (editing) {
    return (
      <HouseholdForm
        household={household}
        onDone={() => {
          setEditing(false);
          fetchData();
        }}
      />
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button className="btn-ghost mb-4" onClick={() => navigate('households')}>
        <ArrowLeft className="h-4 w-4" /> Back to Households
      </button>

      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {head ? getFullName(head) : 'Household'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{household.complete_address || 'No address'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {household.purok && <Badge color="blue">{household.purok}</Badge>}
              {household.village && <Badge color="teal">{household.village}</Badge>}
              {household.household_id_display && <Badge color="slate">ID: {household.household_id_display}</Badge>}
            </div>
          </div>
          {canEdit() && (
            <button className="btn-primary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800">Household Roster ({members.length})</h3>
          </div>
        </div>

        {members.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No members in this household</p>
        ) : (
          <div className="space-y-1">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => navigate('residents', { id: m.id })}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
              >
                <ResidentAvatar r={m} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{getFullName(m)}</p>
                  <p className="text-xs text-slate-500 capitalize">
                    {m.relationship_to_head?.replace('_', ' ') ?? 'Member'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-600">{calculateAge(m.date_of_birth)} yrs</p>
                  <p className="text-xs text-slate-400 capitalize">{m.sex}</p>
                </div>
                {m.relationship_to_head === 'head' && <Badge color="green">Head</Badge>}
              </button>
            ))}
          </div>
        )}
      </div>

      {household.notes && (
        <div className="card p-5 mt-6">
          <h3 className="text-sm font-bold text-slate-800 mb-2">Notes</h3>
          <p className="text-sm text-slate-600">{household.notes}</p>
        </div>
      )}
    </div>
  );
}

function HouseholdForm({ household, onDone }: { household?: Household; onDone: () => void }) {
  const { session } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Household>>(
    household ?? {
      complete_address: '',
      purok: '',
      village: '',
      block: '',
      lot: '',
      household_id_display: '',
      notes: '',
    },
  );

  const set = (key: keyof Household, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = { ...form, updated_by: session?.user.id };
      if (household) {
        await supabase.from('households').update(data).eq('id', household.id);
        await logAudit('Household Updated', 'household', household.id, `Updated household`);
      } else {
        data.created_by = session?.user.id;
        const { data: newRec } = await supabase.from('households').insert(data).select().maybeSingle();
        if (newRec) {
          await logAudit('Household Created', 'household', (newRec as Household).id, `Created household`);
        }
      }
      onDone();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button className="btn-ghost" onClick={onDone}>
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-xl font-bold text-slate-900">{household ? 'Edit Household' : 'Add Household'}</h1>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <label className="label">Household Display ID</label>
          <input className="input" value={form.household_id_display ?? ''} onChange={(e) => set('household_id_display', e.target.value)} placeholder="e.g., HH-0001" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Purok</label>
            <select className="select" value={form.purok ?? ''} onChange={(e) => set('purok', e.target.value)}>
              <option value="">Select...</option>
              {PUROKS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Village</label>
            <select className="select" value={form.village ?? ''} onChange={(e) => set('village', e.target.value)}>
              <option value="">Select...</option>
              {VILLAGES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Block</label>
            <input className="input" value={form.block ?? ''} onChange={(e) => set('block', e.target.value)} />
          </div>
          <div>
            <label className="label">Lot</label>
            <input className="input" value={form.lot ?? ''} onChange={(e) => set('lot', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Complete Address</label>
          <textarea className="input" rows={2} value={form.complete_address ?? ''} onChange={(e) => set('complete_address', e.target.value)} />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </div>
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button className="btn-secondary" onClick={onDone}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
