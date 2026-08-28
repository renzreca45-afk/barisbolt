export const PUROKS = [
  'Purok 1',
  'Purok 2',
  'Purok 3',
  'Purok 4',
  'Purok 5',
  'Purok 6',
  'Purok 7',
] as const;

export const VILLAGES = [
  'North Hill Arbours',
  'GMA Kapuso Village',
  'Coreville',
  'P.I.C.E. Village',
  'Aeroville',
  'SOS North Village',
  'Global Medic',
  'Habitat',
  'Habitat 4466',
] as const;

export const AGE_BRACKETS = [
  { label: '0-4', min: 0, max: 4 },
  { label: '5-12', min: 5, max: 12 },
  { label: '13-17', min: 13, max: 17 },
  { label: '18-24', min: 18, max: 24 },
  { label: '25-59', min: 25, max: 59 },
  { label: '60+', min: 60, max: 200 },
] as const;

export const SENIOR_AGE = 60;

export const SEXES = ['male', 'female'] as const;

export const CIVIL_STATUSES = [
  'single',
  'married',
  'widowed',
  'separated',
  'divorced',
  'annulled',
  'unknown',
] as const;

export const RELATIONSHIPS = [
  'head',
  'spouse',
  'child',
  'parent',
  'sibling',
  'relative',
  'in_law',
  'helper',
  'other',
] as const;

export const VERIFICATION_STATUSES = [
  'imported',
  'for_verification',
  'verified',
  'archived',
] as const;

export const TRANSACTION_STATUSES = [
  'received',
  'processing',
  'ready',
  'released',
  'cancelled',
] as const;

export const USER_ROLES = [
  'super_admin',
  'admin',
  'staff',
  'viewer',
] as const;

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
  viewer: 'Viewer',
};

export const ASSET_CATEGORIES = [
  'logo',
  'seal',
  'signature',
  'frame',
  'border',
  'background',
  'decorative',
  'other',
] as const;

export const PAGE_SIZES = ['a4', 'letter', 'legal'] as const;
export const PAGE_ORIENTATIONS = ['portrait', 'landscape'] as const;

export const PAGE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  a4: { width: 595, height: 842 },
  letter: { width: 612, height: 792 },
  legal: { width: 612, height: 1008 },
};
