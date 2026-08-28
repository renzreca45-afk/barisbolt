import { useEffect, useState } from 'react';
import {
  Users,
  Home,
  UserCheck,
  Heart,
  Accessibility,
  Baby,
  Plane,
  Vote,
  PersonStanding,
  TrendingUp,
  Clock,
  FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useBarangay } from '@/contexts/BarangayContext';
import { calculateAge, formatShortDate, formatCurrency } from '@/lib/age';
import type { DashboardStats } from '@/lib/types';
import { PageHeader } from '@/components/ui';
import { navigate } from '@/lib/router';
import { PUROKS, VILLAGES } from '@/lib/constants';

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'blue',
  onClick,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  color?: 'blue' | 'green' | 'teal' | 'yellow' | 'red' | 'purple' | 'indigo' | 'orange';
  onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    teal: 'from-teal-500 to-teal-600',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    indigo: 'from-indigo-500 to-indigo-600',
    orange: 'from-orange-500 to-orange-600',
  };

  return (
    <button
      onClick={onClick}
      className="card p-5 text-left hover:shadow-md transition-all hover:-translate-y-0.5 group"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${colors[color]} shadow-md flex-shrink-0`}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </button>
  );
}

export function Dashboard() {
  const { profile: barangay } = useBarangay();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<
    Array<{ id: string; action: string; description: string | null; user_name: string | null; created_at: string }>
  >([]);

  useEffect(() => {
    const fetchStats = async () => {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (!error && data) {
        setStats(data as DashboardStats);
      }
      setLoading(false);
    };
    fetchStats();

    const fetchActivity = async () => {
      const { data } = await supabase
        .from('audit_log')
        .select('id, action, description, user_name, created_at')
        .order('created_at', { ascending: false })
        .limit(8);
      if (data) setRecentActivity(data);
    };
    fetchActivity();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-200 rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 bg-slate-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const s = stats ?? ({} as DashboardStats);
  const purokData = PUROKS.map((p) => ({
    label: p,
    count: s.by_purok?.[p] ?? 0,
  }));
  const maxPurok = Math.max(...purokData.map((p) => p.count), 1);

  const villageData = VILLAGES.map((v) => ({
    label: v,
    count: s.by_village?.[v] ?? 0,
  })).filter((v) => v.count > 0);
  const maxVillage = Math.max(...villageData.map((v) => v.count), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        description={
          barangay
            ? `${barangay.barangay_name}, ${barangay.city_municipality}, ${barangay.province}`
            : 'Barangay Administrative Records & Information System'
        }
      />

      {/* Main stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Households"
          value={s.total_households ?? 0}
          icon={Home}
          color="blue"
          onClick={() => navigate('households')}
        />
        <StatCard
          label="Total Residents"
          value={s.total_residents ?? 0}
          icon={Users}
          color="indigo"
          onClick={() => navigate('residents')}
        />
        <StatCard
          label="Male"
          value={s.male ?? 0}
          icon={UserCheck}
          color="teal"
          onClick={() => navigate('residents', { sex: 'male' })}
        />
        <StatCard
          label="Female"
          value={s.female ?? 0}
          icon={UserCheck}
          color="purple"
          onClick={() => navigate('residents', { sex: 'female' })}
        />
      </div>

      {/* Demographic stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="PWD"
          value={s.pwd ?? 0}
          icon={Accessibility}
          color="orange"
          onClick={() => navigate('residents', { pwd: 'true' })}
        />
        <StatCard
          label="Indigent"
          value={s.indigent ?? 0}
          icon={Heart}
          color="red"
          onClick={() => navigate('residents', { indigent: 'true' })}
        />
        <StatCard
          label="Senior Citizens"
          value={s.senior_citizens ?? 0}
          icon={PersonStanding}
          color="yellow"
          onClick={() => navigate('residents', { senior: 'true' })}
        />
        <StatCard
          label="Registered Seniors"
          value={s.registered_seniors ?? 0}
          icon={PersonStanding}
          color="purple"
          onClick={() => navigate('residents', { registeredSenior: 'true' })}
        />
        <StatCard
          label="Solo Parents"
          value={s.solo_parents ?? 0}
          icon={Baby}
          color="teal"
          onClick={() => navigate('residents', { soloParent: 'true' })}
        />
        <StatCard
          label="OFWs"
          value={s.ofws ?? 0}
          icon={Plane}
          color="indigo"
          onClick={() => navigate('residents', { ofw: 'true' })}
        />
        <StatCard
          label="Registered Voters"
          value={s.registered_voters ?? 0}
          icon={Vote}
          color="blue"
          onClick={() => navigate('residents', { voter: 'yes' })}
        />
        <StatCard
          label="Total Population"
          value={s.total_residents ?? 0}
          icon={TrendingUp}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Population by Purok */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Population by Purok</h3>
          <div className="space-y-2.5">
            {purokData.map((p) => (
              <div key={p.label} className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-600 w-16 flex-shrink-0">
                  {p.label}
                </span>
                <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-md transition-all duration-500"
                    style={{ width: `${(p.count / maxPurok) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700 w-10 text-right tabular-nums">
                  {p.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Population by Village */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Population by Village</h3>
          {villageData.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No data available</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {villageData.map((v) => (
                <div key={v.label} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-600 w-32 flex-shrink-0 truncate">
                    {v.label}
                  </span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-md transition-all duration-500"
                      style={{ width: `${(v.count / maxVillage) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-10 text-right tabular-nums">
                    {v.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent transactions */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Recent Document Transactions</h3>
            <button
              onClick={() => navigate('transactions')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View all
            </button>
          </div>
          {s.recent_transactions && s.recent_transactions.length > 0 ? (
            <div className="space-y-2">
              {s.recent_transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 flex-shrink-0">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {t.document_type_name ?? 'Document'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {t.resident_name ?? 'Unknown resident'}
                      {t.purpose ? ` — ${t.purpose}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-slate-700">
                      {formatShortDate(t.date_requested)}
                    </p>
                    {t.fee > 0 && (
                      <p className="text-xs text-slate-400">{formatCurrency(t.fee)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">No transactions yet</p>
          )}
        </div>

        {/* Recent activity */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Recent Activities</h3>
          </div>
          {recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 flex-shrink-0 mt-0.5">
                    <Clock className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{a.action}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {a.description ?? a.user_name ?? ''}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {formatShortDate(a.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
