import { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Users,
  Home,
  FileText,
  Vote,
  Accessibility,
  Heart,
  Baby,
  Plane,
  PersonStanding,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Resident } from '@/lib/types';
import { calculateAge, getFullName, isSenior } from '@/lib/age';
import { PUROKS, VILLAGES, AGE_BRACKETS, SENIOR_AGE } from '@/lib/constants';
import { useBarangay } from '@/contexts/BarangayContext';
import { PageHeader, Badge, EmptyState } from '@/components/ui';
import { exportToCSV, exportTablePDF } from '@/lib/export';

type ReportTab = 'population' | 'social' | 'geographic' | 'household' | 'documents' | 'transactions';

const TABS: { id: ReportTab; label: string; icon: typeof Users }[] = [
  { id: 'population', label: 'Population', icon: Users },
  { id: 'social', label: 'Social', icon: Heart },
  { id: 'geographic', label: 'Geographic', icon: Home },
  { id: 'household', label: 'Household', icon: Home },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'transactions', label: 'Transactions', icon: BarChart3 },
];

export function Reports() {
  const { profile: barangay } = useBarangay();
  const [tab, setTab] = useState<ReportTab>('population');
  const [loading, setLoading] = useState(true);
  const [allResidents, setAllResidents] = useState<Resident[]>([]);
  const [filterPurok, setFilterPurok] = useState('');
  const [filterVillage, setFilterVillage] = useState('');

  // Stats state
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [transactions, setTransactions] = useState<Array<{ status: string; document_types?: { name: string } | null; fee: number; date_requested: string; or_number: string | null; purpose: string; residents?: { first_name: string; last_name: string; middle_name: string; suffix: string } | null }>>([]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);

    let query = supabase.from('residents').select('*').neq('verification_status', 'archived');
    if (filterPurok) query = query.eq('purok', filterPurok);
    if (filterVillage) query = query.eq('village', filterVillage);

    const { data: residents } = await query;
    const r = (residents ?? []) as Resident[];
    setAllResidents(r);

    // Calculate stats
    const ageBrackets: Record<string, number> = {};
    AGE_BRACKETS.forEach((b) => (ageBrackets[b.label] = 0));

    let male = 0, female = 0, pwd = 0, indigent = 0, seniors = 0, regSeniors = 0;
    let soloParents = 0, ofws = 0, voters = 0, nonVoters = 0, unknownVoters = 0;
    const purokCounts: Record<string, number> = {};
    const villageCounts: Record<string, number> = {};

    r.forEach((res) => {
      const age = calculateAge(res.date_of_birth);
      const bracket = age !== null ? (age <= 4 ? '0-4' : age <= 12 ? '5-12' : age <= 17 ? '13-17' : age <= 24 ? '18-24' : age <= 59 ? '25-59' : '60+') : null;
      if (bracket) ageBrackets[bracket]++;

      if (res.sex === 'male') male++;
      if (res.sex === 'female') female++;
      if (res.is_pwd) pwd++;
      if (res.is_indigent) indigent++;
      if (isSenior(res.date_of_birth)) seniors++;
      if (res.is_registered_senior) regSeniors++;
      if (res.is_solo_parent) soloParents++;
      if (res.is_ofw) ofws++;
      if (res.registered_voter === 'yes') voters++;
      else if (res.registered_voter === 'no') nonVoters++;
      else unknownVoters++;

      const p = res.purok || 'Unassigned';
      purokCounts[p] = (purokCounts[p] ?? 0) + 1;
      const v = res.village || 'Unassigned';
      villageCounts[v] = (villageCounts[v] ?? 0) + 1;
    });

    // Household stats
    const householdMap: Record<string, Resident[]> = {};
    r.forEach((res) => {
      if (res.household_id) {
        if (!householdMap[res.household_id]) householdMap[res.household_id] = [];
        householdMap[res.household_id].push(res);
      }
    });

    let hhdWithPwd = 0, hhdWithSeniors = 0, hhdWithIndigent = 0;
    const householdSizes: number[] = [];
    const householdHeads: Array<{ id: string; head: string; size: number }> = [];

    Object.entries(householdMap).forEach(([hid, members]) => {
      householdSizes.push(members.length);
      const head = members.find((m) => m.relationship_to_head === 'head');
      householdHeads.push({ id: hid, head: head ? getFullName(head) : 'No head assigned', size: members.length });
      if (members.some((m) => m.is_pwd)) hhdWithPwd++;
      if (members.some((m) => isSenior(m.date_of_birth))) hhdWithSeniors++;
      if (members.some((m) => m.is_indigent)) hhdWithIndigent++;
    });

    setStats({
      total: r.length,
      male, female, pwd, indigent, seniors, regSeniors, soloParents, ofws,
      voters, nonVoters, unknownVoters,
      ageBrackets,
      purokCounts, villageCounts,
      totalHouseholds: Object.keys(householdMap).length,
      avgHouseholdSize: householdSizes.length > 0 ? (householdSizes.reduce((a, b) => a + b, 0) / householdSizes.length).toFixed(1) : '0',
      hhdWithPwd, hhdWithSeniors, hhdWithIndigent,
      householdHeads: householdHeads.sort((a, b) => b.size - a.size),
    });

    // Fetch transactions for transaction report
    let txQuery = supabase
      .from('transactions')
      .select('*, document_types!left(name), residents!left(first_name, last_name, middle_name, suffix)')
      .order('created_at', { ascending: false });
    if (filterPurok) {
      // Transactions don't have purok directly — skip for now
    }
    const { data: txns } = await txQuery.limit(500);
    setTransactions((txns ?? []) as typeof transactions);

    setLoading(false);
  }, [filterPurok, filterVillage]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const subtitle = [
    barangay?.barangay_name,
    filterPurok,
    filterVillage,
  ].filter(Boolean).join(' — ');

  const handleExportCSV = () => {
    if (tab === 'documents' || tab === 'transactions') {
      exportToCSV(
        transactions.map((t) => ({
          Date: t.date_requested,
          Resident: t.residents ? getFullName(t.residents) : '',
          'Document Type': t.document_types?.name ?? '',
          Purpose: t.purpose,
          Status: t.status,
          'OR Number': t.or_number ?? '',
          Fee: t.fee,
        })),
        `report_${tab}_${new Date().toISOString().split('T')[0]}`,
      );
    } else {
      exportToCSV(
        allResidents.map((r) => ({
          'Last Name': r.last_name,
          'First Name': r.first_name,
          'Middle Name': r.middle_name,
          Age: calculateAge(r.date_of_birth) ?? '',
          Sex: r.sex ?? '',
          Purok: r.purok ?? '',
          Village: r.village ?? '',
          PWD: r.is_pwd ? 'Yes' : 'No',
          Indigent: r.is_indigent ? 'Yes' : 'No',
          Senior: isSenior(r.date_of_birth) ? 'Yes' : 'No',
          'Reg. Senior': r.is_registered_senior ? 'Yes' : 'No',
          'Solo Parent': r.is_solo_parent ? 'Yes' : 'No',
          OFW: r.is_ofw ? 'Yes' : 'No',
          Voter: r.registered_voter,
        })),
        `report_${tab}_${new Date().toISOString().split('T')[0]}`,
      );
    }
  };

  const handlePrint = () => {
    let html = '';
    let title = '';

    if (tab === 'population') {
      title = 'Population Report';
      html = `<h1>${title}</h1><p>${subtitle}</p><p>Total: ${stats.total as number}</p>
        <table><tr><th>Category</th><th>Count</th></tr>
        <tr><td>Male</td><td>${stats.male as number}</td></tr>
        <tr><td>Female</td><td>${stats.female as number}</td></tr>
        ${AGE_BRACKETS.map((b) => `<tr><td>Age ${b.label}</td><td>${(stats.ageBrackets as Record<string, number>)[b.label] ?? 0}</td></tr>`).join('')}
        <tr><td>Senior Citizens (60+)</td><td>${stats.seniors as number}</td></tr>
        <tr><td>Registered Seniors</td><td>${stats.regSeniors as number}</td></tr>
        </table>`;
    } else if (tab === 'social') {
      title = 'Social Classification Report';
      html = `<h1>${title}</h1><p>${subtitle}</p>
        <table><tr><th>Classification</th><th>Count</th></tr>
        <tr><td>PWD</td><td>${stats.pwd as number}</td></tr>
        <tr><td>Indigent</td><td>${stats.indigent as number}</td></tr>
        <tr><td>Solo Parents</td><td>${stats.soloParents as number}</td></tr>
        <tr><td>OFWs</td><td>${stats.ofws as number}</td></tr>
        <tr><td>Registered Voters</td><td>${stats.voters as number}</td></tr>
        <tr><td>Non-Voters</td><td>${stats.nonVoters as number}</td></tr>
        <tr><td>Unknown Voter Status</td><td>${stats.unknownVoters as number}</td></tr>
        </table>`;
    } else if (tab === 'geographic') {
      title = 'Geographic Distribution Report';
      const pc = stats.purokCounts as Record<string, number>;
      const vc = stats.villageCounts as Record<string, number>;
      html = `<h1>${title}</h1><p>${subtitle}</p>
        <h2>By Purok</h2><table><tr><th>Purok</th><th>Count</th></tr>
        ${Object.entries(pc).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
        <h2>By Village</h2><table><tr><th>Village</th><th>Count</th></tr>
        ${Object.entries(vc).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
    } else if (tab === 'household') {
      title = 'Household Report';
      html = `<h1>${title}</h1><p>${subtitle}</p>
        <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total Households</td><td>${stats.totalHouseholds as number}</td></tr>
        <tr><td>Average Size</td><td>${stats.avgHouseholdSize as string}</td></tr>
        <tr><td>Households with PWD</td><td>${stats.hhdWithPwd as number}</td></tr>
        <tr><td>Households with Seniors</td><td>${stats.hhdWithSeniors as number}</td></tr>
        <tr><td>Households with Indigent</td><td>${stats.hhdWithIndigent as number}</td></tr>
        </table>`;
    } else if (tab === 'documents' || tab === 'transactions') {
      title = tab === 'documents' ? 'Document Report' : 'Transaction Report';
      html = `<h1>${title}</h1><p>${subtitle}</p>
        <table><tr><th>Date</th><th>Resident</th><th>Document</th><th>Purpose</th><th>Status</th><th>OR#</th><th>Fee</th></tr>
        ${transactions.map((t) => `<tr><td>${t.date_requested}</td><td>${t.residents ? getFullName(t.residents) : ''}</td><td>${t.document_types?.name ?? ''}</td><td>${t.purpose}</td><td>${t.status}</td><td>${t.or_number ?? ''}</td><td>${t.fee}</td></tr>`).join('')}
        </table>`;
    }

    exportTablePDF(title, subtitle, [], []);
    // Use printHTML directly
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:Inter,sans-serif;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}th{background:#f4f6f9}h1{font-size:18px}h2{font-size:14px}</style></head><body>${html}</body></html>`);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Reports"
        description={subtitle || 'Comprehensive barangay statistics and reports'}
        actions={
          <>
            <button className="btn-secondary" onClick={handlePrint} disabled={loading}>
              <Printer className="h-4 w-4" /> Print
            </button>
            <button className="btn-secondary" onClick={handleExportCSV} disabled={loading}>
              <Download className="h-4 w-4" /> CSV
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="label">Filter by Purok</label>
            <select className="select" value={filterPurok} onChange={(e) => setFilterPurok(e.target.value)}>
              <option value="">All Puroks</option>
              {PUROKS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="label">Filter by Village</label>
            <select className="select" value={filterVillage} onChange={(e) => setFilterVillage(e.target.value)}>
              <option value="">All Villages</option>
              {VILLAGES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                tab === t.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="card p-8 text-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" /></div>
      ) : (
        <ReportContent tab={tab} stats={stats} transactions={transactions} />
      )}
    </div>
  );
}

function StatBox({ label, value, color = 'blue' }: { label: string; value: number | string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    yellow: 'border-yellow-200 bg-yellow-50',
    red: 'border-red-200 bg-red-50',
    teal: 'border-teal-200 bg-teal-50',
    purple: 'border-purple-200 bg-purple-50',
    orange: 'border-orange-200 bg-orange-50',
    indigo: 'border-indigo-200 bg-indigo-50',
    slate: 'border-slate-200 bg-slate-50',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] ?? colors.blue}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800 tabular-nums">{value}</p>
    </div>
  );
}

function ReportContent({ tab, stats, transactions }: { tab: ReportTab; stats: Record<string, unknown>; transactions: Array<{ status: string; document_types?: { name: string } | null; fee: number; date_requested: string; or_number: string | null; purpose: string; residents?: { first_name: string; last_name: string; middle_name: string; suffix: string } | null }> }) {
  if (tab === 'population') {
    const ab = stats.ageBrackets as Record<string, number>;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatBox label="Total Residents" value={stats.total as number} color="blue" />
          <StatBox label="Male" value={stats.male as number} color="teal" />
          <StatBox label="Female" value={stats.female as number} color="purple" />
          <StatBox label="Senior Citizens" value={stats.seniors as number} color="yellow" />
          <StatBox label="Registered Seniors" value={stats.regSeniors as number} color="orange" />
          <StatBox label="Total" value={stats.total as number} color="slate" />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Age Brackets</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {AGE_BRACKETS.map((b) => (
              <StatBox key={b.label} label={`Age ${b.label}`} value={ab?.[b.label] ?? 0} color="indigo" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'social') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatBox label="PWD" value={stats.pwd as number} color="orange" />
        <StatBox label="Indigent" value={stats.indigent as number} color="red" />
        <StatBox label="Solo Parents" value={stats.soloParents as number} color="teal" />
        <StatBox label="OFWs" value={stats.ofws as number} color="indigo" />
        <StatBox label="Registered Voters" value={stats.voters as number} color="blue" />
        <StatBox label="Non-Voters" value={stats.nonVoters as number} color="slate" />
        <StatBox label="Unknown Voter Status" value={stats.unknownVoters as number} color="slate" />
        <StatBox label="Registered Seniors" value={stats.regSeniors as number} color="purple" />
      </div>
    );
  }

  if (tab === 'geographic') {
    const pc = stats.purokCounts as Record<string, number>;
    const vc = stats.villageCounts as Record<string, number>;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">By Purok</h3>
          <div className="space-y-2">
            {Object.entries(pc).sort().map(([k, v]) => (
              <div key={k} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-700">{k}</span>
                <Badge color="blue">{v}</Badge>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">By Village</h3>
          <div className="space-y-2">
            {Object.entries(vc).sort().map(([k, v]) => (
              <div key={k} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-700">{k}</span>
                <Badge color="teal">{v}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'household') {
    const heads = (stats.householdHeads as Array<{ id: string; head: string; size: number }>) ?? [];
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatBox label="Total Households" value={stats.totalHouseholds as number} color="blue" />
          <StatBox label="Average Size" value={stats.avgHouseholdSize as string} color="green" />
          <StatBox label="With PWD" value={stats.hhdWithPwd as number} color="orange" />
          <StatBox label="With Seniors" value={stats.hhdWithSeniors as number} color="yellow" />
          <StatBox label="With Indigent" value={stats.hhdWithIndigent as number} color="red" />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Largest Households</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Head</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Members</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {heads.slice(0, 20).map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-2 text-sm text-slate-700">{h.head}</td>
                    <td className="px-3 py-2"><Badge color="blue">{h.size}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'documents' || tab === 'transactions') {
    const byDocType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalFees = 0;
    transactions.forEach((t) => {
      const name = t.document_types?.name ?? 'Unknown';
      byDocType[name] = (byDocType[name] ?? 0) + 1;
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      totalFees += t.fee;
    });

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatBox label="Total Transactions" value={transactions.length} color="blue" />
          <StatBox label="Total Fees" value={`₱${totalFees.toFixed(2)}`} color="green" />
          <StatBox label="Document Types" value={Object.keys(byDocType).length} color="teal" />
          <StatBox label="Released" value={byStatus['released'] ?? 0} color="purple" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4">By Document Type</h3>
            <div className="space-y-2">
              {Object.entries(byDocType).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-700">{k}</span>
                  <Badge color="blue">{v}</Badge>
                </div>
              ))}
              {Object.keys(byDocType).length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No data</p>}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4">By Status</h3>
            <div className="space-y-2">
              {Object.entries(byStatus).map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm text-slate-700 capitalize">{k}</span>
                  <Badge color={k === 'released' ? 'green' : k === 'cancelled' ? 'red' : 'yellow'}>{v}</Badge>
                </div>
              ))}
              {Object.keys(byStatus).length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No data</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
