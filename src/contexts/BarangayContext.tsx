import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { BarangayProfile } from '@/lib/types';

interface BarangayContextValue {
  profile: BarangayProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const BarangayContext = createContext<BarangayContextValue | undefined>(undefined);

export function BarangayProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<BarangayProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('barangay_profile')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (!error && data) {
      setProfile(data as BarangayProfile);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <BarangayContext.Provider value={{ profile, loading, refresh: fetchProfile }}>
      {children}
    </BarangayContext.Provider>
  );
}

export function useBarangay() {
  const ctx = useContext(BarangayContext);
  if (!ctx) throw new Error('useBarangay must be used within BarangayProvider');
  return ctx;
}
