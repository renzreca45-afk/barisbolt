import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  Users,
  Download,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Resident } from '@/lib/types';
import { calculateAge, getFullName, formatShortDate } from '@/lib/age';
import { PUROKS, VILLAGES, SEXES, AGE_BRACKETS, SENIOR_AGE } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { navigate, type RouteState } from '@/lib/router';
import { PageHeader, Badge, EmptyState } from '@/components/ui';
import { ResidentAvatar, ResidentBadges, VerificationBadge } from '@/components/ResidentShared';
import { exportToCSV } from '@/lib/export';

const PAGE_SIZE = 25;

interface ResidentWithHousehold extends Resident {
  households?: { complete_address: string; household_id_display: string | null } | null;
}

export function ResidentsList({ routeParams }: { routeParams: Record<string, string> }) {
  const { canEdit } = useAuth();
  const [residents, setResidents] = useState<ResidentWithHousehold[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [filters, setFilters] = useState<Record<string, string | undefined>>({});

  // Apply route params as initial filters
  useEffect(() => {
    if (routeParams && Object.keys(routeParams).length > 0) {
      const newFilters: Record<string, string> = {};
      const allowedKeys = ['sex', 'pwd', 'indigent', 'senior', 'registeredSenior', 'soloParent', 'ofw', 'voter', 'purok', 'village', 'ageBracket'];
      Object.entries(routeParams).forEach(([key, value]) => {
        if (allowedKeys.includes(key)) {
          newFilters[key] = value;
        }
      });
      if (Object.keys(newFilters).length > 0) {
        setFilters(newFilters);
        setShowFilters(true);
      }
    }
  }, [routeParams]);

  const buildQuery = useCallback(
    (forCount: boolean) => {
      let query = supabase.from('residents').select(
        forCount
          ? 'id'
          : '*, households!left(complete_address, household_id_display)',
        { count: 'forCount' as never },
      );

      // Exclude archived by default
      query = query.neq('verification_status', 'archived');

      // Search
      if (search.trim()) {
        const terms = search.trim().split(/\s+/);
        if (terms.length === 1) {
          query = query.or(
            `first_name.ilike.%${terms[0]}%,last_name.ilike.%${terms[0]}%,middle_name.ilike.%${terms[0]}%`,
          );
        } else {
          query = query.or(
            `first_name.ilike.%${terms[0]}%,last_name.ilike.%${terms[terms.length - 1]}%`,
          );
        }
      }

      // Filters
      if (filters.purok) query = query.eq('purok', filters.purok);
      if (filters.village) query = query.eq('village', filters.village);
      if (filters.sex) query = query.eq('sex', filters.sex);
      if (filters.pwd === 'true') query = query.eq('is_pwd', true);
      if (filters.indigent === 'true') query = query.eq('is_indigent', true);
      if (filters.senior === 'true') {
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - SENIOR_AGE);
        query = query.lte('date_of_birth', cutoff.toISOString().split('T')[0]);
      }
      if (filters.registeredSenior === 'true') query = query.eq('is_registered_senior', true);
      if (filters.soloParent === 'true') query = query.eq('is_solo_parent', true);
      if (filters.ofw === 'true') query = query.eq('is_ofw', true);
      if (filters.voter) query = query.eq('registered_voter', filters.voter);
      if (filters.verification) query = query.eq('verification_status', filters.verification);

      if (filters.ageBracket) {
        const bracket = AGE_BRACKETS.find((b) => b.label === filters.ageBracket);
        if (bracket) {
          const today = new Date();
          const maxDate = new Date(today);
          maxDate.setFullYear(maxDate.getFullYear() - bracket.min);
          const minDate = new Date(today);
          minDate.setFullYear(minDate.getFullYear() - bracket.max - 1);
          query = query.lt('date_of_birth', maxDate.toISOString().split('T')[0]).gte(
            'date_of_birth',
            minDate.toISOString().split('T')[0],
          );
        }
      }

      return query;
    },
    [search, filters],
  );

  const fetchResidents = useCallback(async () => {
    setLoading(true);
    const countQuery = buildQuery(true);
    const { count: totalCount } = await countQuery;
    setCount(totalCount ?? 0);

    const dataQuery = buildQuery(false)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    const { data, error } = await dataQuery;
    if (error) {
      console.error('Error fetching residents:', error);
    }
    setResidents((data ?? []) as unknown as ResidentWithHousehold[]);
    setLoading(false);
  }, [buildQuery, page]);

  useEffect(() => {
    fetchResidents();
  }, [fetchResidents]);

  // Reset page when search/filters change
  useEffect(() => {
    setPage(0);
  }, [search, filters]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  const handleExport = async () => {
    setExporting(true);
    const { data } = await buildQuery(false).order('last_name', { ascending: true });
    const rows = (data ?? []) as unknown as ResidentWithHousehold[];
    const csvData = rows.map((r) => ({
      'Last Name': r.last_name,
      'First Name': r.first_name,
      'Middle Name': r.middle_name,
      Suffix: r.suffix,
      Age: calculateAge(r.date_of_birth) ?? '',
      Sex: r.sex ?? '',
      'Date of Birth': r.date_of_birth ?? '',
      Purok: r.purok ?? '',
      Village: r.village ?? '',
      Address: r.complete_address,
      'Contact Number': r.contact_number ?? '',
      PWD: r.is_pwd ? 'Yes' : 'No',
      Indigent: r.is_indigent ? 'Yes' : 'No',
      'Senior Citizen': isSeniorCheck(r.date_of_birth) ? 'Yes' : 'No',
      'Registered Senior': r.is_registered_senior ? 'Yes' : 'No',
      'Solo Parent': r.is_solo_parent ? 'Yes' : 'No',
      OFW: r.is_ofw ? 'Yes' : 'No',
      '4Ps': r.is_4ps ? 'Yes' : 'No',
      'Registered Voter': r.registered_voter,
      'Verification Status': r.verification_status,
    }));
    exportToCSV(csvData, `residents_${new Date().toISOString().split('T')[0]}`);
    setExporting(false);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Residents"
        description={`${count} resident${count !== 1 ? 's' : ''} in records`}
        actions={
          <>
            <button className="btn-secondary" onClick={handleExport} disabled={exporting || count === 0}>
              <Download className="h-4 w-4" /> Export
            </button>
            {canEdit() && (
              <button className="btn-primary" onClick={() => navigate('residents', { id: 'new' })}>
                <Plus className="h-4 w-4" /> Add Resident
              </button>
            )}
          </>
        }
      />

      {/* Search bar */}
      <div className="card p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Search by name (first, last, or middle)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            className={`btn-secondary ${activeFilterCount > 0 ? '!border-blue-300 !bg-blue-50 !text-blue-700' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" /> Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-blue-600 text-white text-xs px-1.5 py-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
            <div>
              <label className="label">Purok</label>
              <select
                className="select"
                value={filters.purok ?? ''}
                onChange={(e) => setFilters({ ...filters, purok: e.target.value || undefined })}
              >
                <option value="">All Puroks</option>
                {PUROKS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Village</label>
              <select
                className="select"
                value={filters.village ?? ''}
                onChange={(e) => setFilters({ ...filters, village: e.target.value || undefined })}
              >
                <option value="">All Villages</option>
                {VILLAGES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Sex</label>
              <select
                className="select"
                value={filters.sex ?? ''}
                onChange={(e) => setFilters({ ...filters, sex: e.target.value || undefined })}
              >
                <option value="">All</option>
                {SEXES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Age Bracket</label>
              <select
                className="select"
                value={filters.ageBracket ?? ''}
                onChange={(e) => setFilters({ ...filters, ageBracket: e.target.value || undefined })}
              >
                <option value="">All Ages</option>
                {AGE_BRACKETS.map((b) => (
                  <option key={b.label} value={b.label}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">PWD</label>
              <select
                className="select"
                value={filters.pwd ?? ''}
                onChange={(e) => setFilters({ ...filters, pwd: e.target.value || undefined })}
              >
                <option value="">All</option>
                <option value="true">PWD only</option>
              </select>
            </div>
            <div>
              <label className="label">Indigent</label>
              <select
                className="select"
                value={filters.indigent ?? ''}
                onChange={(e) => setFilters({ ...filters, indigent: e.target.value || undefined })}
              >
                <option value="">All</option>
                <option value="true">Indigent only</option>
              </select>
            </div>
            <div>
              <label className="label">Senior Citizen</label>
              <select
                className="select"
                value={filters.senior ?? ''}
                onChange={(e) => setFilters({ ...filters, senior: e.target.value || undefined })}
              >
                <option value="">All</option>
                <option value="true">Senior (60+) only</option>
              </select>
            </div>
            <div>
              <label className="label">Registered Senior</label>
              <select
                className="select"
                value={filters.registeredSenior ?? ''}
                onChange={(e) => setFilters({ ...filters, registeredSenior: e.target.value || undefined })}
              >
                <option value="">All</option>
                <option value="true">Registered Senior only</option>
              </select>
            </div>
            <div>
              <label className="label">Solo Parent</label>
              <select
                className="select"
                value={filters.soloParent ?? ''}
                onChange={(e) => setFilters({ ...filters, soloParent: e.target.value || undefined })}
              >
                <option value="">All</option>
                <option value="true">Solo Parent only</option>
              </select>
            </div>
            <div>
              <label className="label">OFW</label>
              <select
                className="select"
                value={filters.ofw ?? ''}
                onChange={(e) => setFilters({ ...filters, ofw: e.target.value || undefined })}
              >
                <option value="">All</option>
                <option value="true">OFW only</option>
              </select>
            </div>
            <div>
              <label className="label">Registered Voter</label>
              <select
                className="select"
                value={filters.voter ?? ''}
                onChange={(e) => setFilters({ ...filters, voter: e.target.value || undefined })}
              >
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div>
              <label className="label">Verification</label>
              <select
                className="select"
                value={filters.verification ?? ''}
                onChange={(e) => setFilters({ ...filters, verification: e.target.value || undefined })}
              >
                <option value="">All</option>
                <option value="verified">Verified</option>
                <option value="for_verification">For Verification</option>
                <option value="imported">Imported</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            {activeFilterCount > 0 && (
              <div className="flex items-end">
                <button
                  className="btn-ghost text-red-600 hover:bg-red-50"
                  onClick={() => setFilters({})}
                >
                  <X className="h-4 w-4" /> Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="card p-8 text-center">
          <div className="animate-pulse text-slate-400">Loading residents...</div>
        </div>
      ) : residents.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title="No residents found"
            description={search || activeFilterCount > 0 ? "Try adjusting your search or filters." : "Add your first resident to get started."}
            action={canEdit() && !search && activeFilterCount === 0 ? (
              <button className="btn-primary" onClick={() => navigate('residents', { id: 'new' })}>
                <Plus className="h-4 w-4" /> Add Resident
              </button>
            ) : undefined}
          />
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Resident</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell">Age/Sex</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden xl:table-cell">Classifications</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {residents.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate('residents', { id: r.id })}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ResidentAvatar r={r} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {getFullName(r)}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {r.complete_address || r.purok || r.village || 'No address'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-sm text-slate-700">
                          {calculateAge(r.date_of_birth) ?? '—'} yrs
                        </p>
                        <p className="text-xs text-slate-500 capitalize">{r.sex ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="text-sm text-slate-700">{r.purok ?? '—'}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[180px]">{r.village ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <ResidentBadges r={r} />
                      </td>
                      <td className="px-4 py-3">
                        <VerificationBadge status={r.verification_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                Page {page + 1} of {totalPages} ({count} total)
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary !px-3"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  className="btn-secondary !px-3"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
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

function isSeniorCheck(dob: string | null): boolean {
  const age = calculateAge(dob);
  return age !== null && age >= 60;
}
