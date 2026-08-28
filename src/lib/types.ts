export type UserRole = 'super_admin' | 'admin' | 'staff' | 'viewer';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BarangayProfile {
  id: number;
  barangay_name: string;
  barangay_number: string;
  city_municipality: string;
  province: string;
  region: string;
  complete_address: string;
  contact_number: string;
  email: string;
  website: string;
  punong_barangay: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Household {
  id: string;
  source_household_id: string | null;
  household_id_display: string | null;
  purok: string | null;
  village: string | null;
  block: string | null;
  lot: string | null;
  complete_address: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface Resident {
  id: string;
  source_id: string | null;
  source_resident_id: string | null;

  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  date_of_birth: string | null;
  sex: 'male' | 'female' | null;
  civil_status: string | null;
  nationality: string;
  place_of_birth: string | null;
  religion: string | null;

  contact_number: string | null;
  email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_number: string | null;
  emergency_contact_relationship: string | null;

  household_id: string | null;
  relationship_to_head: string | null;
  purok: string | null;
  village: string | null;
  block: string | null;
  lot: string | null;
  complete_address: string;
  residency_info: string | null;

  is_indigent: boolean;
  indigent_source: string | null;
  is_pwd: boolean;
  pwd_details: string | null;
  is_registered_senior: boolean;
  senior_registration_source: string | null;
  is_solo_parent: boolean;
  solo_parent_registered: boolean;
  solo_parent_source: string | null;
  is_4ps: boolean;
  four_ps_source: string | null;
  is_ofw: boolean;
  ofw_source: string | null;
  registered_voter: 'yes' | 'no' | 'unknown';
  voter_registration_source: string | null;

  school: string | null;
  current_enrollment: string | null;
  highest_education: string | null;
  course_strand: string | null;

  employment_status: string | null;
  occupation: string | null;
  employer: string | null;
  place_of_work: string | null;
  employment_type: string | null;
  monthly_income: number | null;
  daily_income: number | null;

  verification_status: 'imported' | 'for_verification' | 'verified' | 'archived';
  verified_date: string | null;
  verified_by: string | null;
  verification_notes: string | null;

  admin_notes: string | null;

  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface BarangayOfficial {
  id: string;
  name: string;
  position: string;
  is_active: boolean;
  term_start: string | null;
  term_end: string | null;
  signature_url: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  default_fee: number;
  is_active: boolean;
  allow_download: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateElement {
  id: string;
  type: 'text' | 'image' | 'shape' | 'line' | 'textbox';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  // Text properties
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  // Shape properties
  shape?: 'rect' | 'circle' | 'line';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  // Image properties
  src?: string;
  opacity?: number;
  // Dynamic field
  field?: string;
}

export interface TemplatePageSettings {
  pageSize: 'a4' | 'letter' | 'legal';
  orientation: 'portrait' | 'landscape';
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  background?: string;
  watermark?: string;
  watermarkOpacity?: number;
}

export interface DocumentTemplate {
  id: string;
  document_type_id: string | null;
  name: string;
  template_json: {
    page: TemplatePageSettings;
    elements: TemplateElement[];
  };
  version_number: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  url: string;
  description: string | null;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  resident_id: string | null;
  document_type_id: string | null;
  template_id: string | null;
  purpose: string;
  date_requested: string;
  status: 'received' | 'processing' | 'ready' | 'released' | 'cancelled';
  or_number: string | null;
  fee: number;
  processed_by: string | null;
  released_date: string | null;
  notes: string | null;
  resident_snapshot: Record<string, unknown> | null;
  custom_fields: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  record_type: string | null;
  record_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardStats {
  total_households: number;
  total_residents: number;
  male: number;
  female: number;
  pwd: number;
  indigent: number;
  senior_citizens: number;
  registered_seniors: number;
  solo_parents: number;
  ofws: number;
  registered_voters: number;
  by_purok: Record<string, number>;
  by_village: Record<string, number>;
  recent_transactions: Array<{
    id: string;
    purpose: string;
    status: string;
    date_requested: string;
    or_number: string | null;
    fee: number;
    document_type_name: string | null;
    resident_name: string | null;
    created_at: string;
  }>;
}
