import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BarangayProvider, useBarangay } from '@/contexts/BarangayContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { AppShell } from '@/components/AppShell';
import { Dashboard } from '@/screens/Dashboard';
import { ResidentsList } from '@/screens/ResidentsList';
import { ResidentProfile } from '@/screens/ResidentProfile';
import { Households } from '@/screens/Households';
import { Transactions } from '@/screens/Transactions';
import { Reports } from '@/screens/Reports';
import { Administration } from '@/screens/Administration';
import { Documents } from '@/screens/Documents';
import { useRouter, type Route } from '@/lib/router';
import { ResidentForm } from '@/components/ResidentForm';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { session, profile, loading } = useAuth();
  const { route, params } = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session || !profile) {
    return <LoginScreen />;
  }

  if (!profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="card p-8 text-center max-w-md">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Account Inactive</h1>
          <p className="text-sm text-slate-500">Your account has been deactivated. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell currentRoute={route as Route}>
      <RouteRenderer route={route as Route} params={params} />
    </AppShell>
  );
}

function RouteRenderer({ route, params }: { route: Route; params: Record<string, string> }) {
  if (route === 'dashboard') return <Dashboard />;

  if (route === 'residents') {
    if (params.id === 'new') {
      return (
        <div className="p-6 max-w-5xl mx-auto">
          <h1 className="text-xl font-bold text-slate-900 mb-6">Add New Resident</h1>
          <ResidentForm resident={null} onSaved={() => (window.location.hash = '#/residents')} onCancel={() => (window.location.hash = '#/residents')} />
        </div>
      );
    }
    if (params.id && params.id !== 'new') {
      return <ResidentProfile residentId={params.id} />;
    }
    return <ResidentsList routeParams={params} />;
  }

  if (route === 'households') return <Households routeParams={params} />;
  if (route === 'documents') return <Documents routeParams={params} />;
  if (route === 'transactions') return <Transactions />;
  if (route === 'reports') return <Reports />;
  if (route === 'admin') return <Administration />;

  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <BarangayProvider>
        <AppContent />
      </BarangayProvider>
    </AuthProvider>
  );
}
