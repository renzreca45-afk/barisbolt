import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Home,
  FileText,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBarangay } from '@/contexts/BarangayContext';
import { navigate, type Route } from '@/lib/router';
import { ROLE_LABELS } from '@/lib/constants';

const NAV_ITEMS: { route: Route; label: string; icon: typeof Users }[] = [
  { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { route: 'residents', label: 'Residents', icon: Users },
  { route: 'households', label: 'Households', icon: Home },
  { route: 'documents', label: 'Documents', icon: FileText },
  { route: 'transactions', label: 'Transactions', icon: Receipt },
  { route: 'reports', label: 'Reports', icon: BarChart3 },
];

export function AppShell({
  currentRoute,
  children,
}: {
  currentRoute: Route;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const { profile: barangay } = useBarangay();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const showAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';

  const allNavItems = showAdmin
    ? [...NAV_ITEMS, { route: 'admin' as Route, label: 'Administration', icon: Settings }]
    : NAV_ITEMS;

  const handleSignOut = async () => {
    await signOut();
    navigate('dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex-shrink-0">
            {barangay?.logo_url ? (
              <img src={barangay.logo_url} alt="" className="h-8 w-8 rounded-md object-cover" />
            ) : (
              <Building2 className="h-5 w-5 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight">BARIS</p>
            <p className="text-[10px] text-slate-400 truncate">
              {barangay?.barangay_name ?? 'Loading...'}
            </p>
          </div>
          <button
            className="ml-auto lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {allNavItems.map((item) => {
            const Icon = item.icon;
            const active = currentRoute === item.route;
            return (
              <button
                key={item.route}
                onClick={() => {
                  navigate(item.route);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white flex-shrink-0">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-slate-400">
                {profile ? ROLE_LABELS[profile.role] : ''}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-all"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-slate-200 h-14 flex items-center px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-2 text-sm font-semibold text-slate-800">BARIS</span>
        </header>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
