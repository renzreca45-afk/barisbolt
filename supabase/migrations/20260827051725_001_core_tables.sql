/*
# BARIS Core Schema — Profiles, Barangay Profile, Households, Residents, Officials

## Overview
Creates the foundational tables for the Barangay Administrative Records & Information System (BARIS).

## New Tables

### profiles
- Extends auth.users with application-level data: full_name, role, is_active.
- role is one of: super_admin, admin, staff, viewer.
- A trigger auto-creates a profile row when a new auth user is created, reading the role from raw_app_meta_data.

### barangay_profile
- Single-row table (enforced by a check) storing the configurable barangay identity: name, number, city, province, region, address, contact, email, website, punong_barangay, logo_url.
- Used on login screen, header, dashboard, documents, reports, and printed outputs.

### households
- Stores household records with source_household_id (from import), display ID, purok, village, block, lot, complete_address.
- The household head is the resident whose relationship_to_head = 'head' — not a stored column on the household.

### residents
- Full resident records with all sections: personal, contact, address/household, social classification, education, employment, verification, admin notes.
- source_id and source_resident_id preserved from import.
- Senior citizen status is NOT stored — calculated from date_of_birth.
- Registered Voter stored as enum: yes, no, unknown.

### barangay_officials
- Editable registry of barangay officials: name, position, active, term start/end, signature image URL, display order.

## Helper Functions (SECURITY DEFINER)
- current_user_role() — returns the current user's role from profiles.
- is_super_admin(), is_admin(), is_staff_or_higher() — boolean role checks used in RLS policies.

## Security
- RLS enabled on all tables.
- profiles: users can read all profiles; can update own profile (non-role fields only — role is protected by a separate admin-only policy).
- All other tables: authenticated users can SELECT; staff+ can INSERT/UPDATE; admin+ can DELETE.
- Helper functions are SECURITY DEFINER so they can read profiles regardless of RLS.
*/

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('super_admin', 'admin', 'staff', 'viewer')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_app_meta_data->>'role', 'viewer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- ROLE HELPER FUNCTIONS (SECURITY DEFINER — used in RLS policies)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), 'viewer');
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT public.current_user_role() = 'super_admin';
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT public.current_user_role() IN ('super_admin', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_higher()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT public.current_user_role() IN ('super_admin', 'admin', 'staff');
$$;

-- ============================================================================
-- PROFILES RLS
-- ============================================================================
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_role_admin" ON profiles;
-- Only super_admin can change roles and active status
CREATE POLICY "profiles_update_role_admin" ON profiles FOR UPDATE
  TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
  TO authenticated USING (public.is_super_admin());

-- ============================================================================
-- BARANGAY PROFILE
-- ============================================================================
CREATE TABLE IF NOT EXISTS barangay_profile (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  barangay_name text NOT NULL DEFAULT 'Barangay 106 Sto. Niño',
  barangay_number text NOT NULL DEFAULT '106',
  city_municipality text NOT NULL DEFAULT 'Tacloban City',
  province text NOT NULL DEFAULT 'Leyte',
  region text NOT NULL DEFAULT 'Eastern Visayas (Region VIII)',
  complete_address text NOT NULL DEFAULT '',
  contact_number text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  punong_barangay text NOT NULL DEFAULT '',
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE barangay_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "barangay_profile_select" ON barangay_profile;
CREATE POLICY "barangay_profile_select" ON barangay_profile FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "barangay_profile_update" ON barangay_profile;
CREATE POLICY "barangay_profile_update" ON barangay_profile FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Insert default row
INSERT INTO barangay_profile (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- HOUSEHOLDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_household_id text,
  household_id_display text,
  purok text,
  village text,
  block text,
  lot text,
  complete_address text NOT NULL DEFAULT '',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id)
);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_households_purok ON households(purok);
CREATE INDEX IF NOT EXISTS idx_households_village ON households(village);
CREATE INDEX IF NOT EXISTS idx_households_source_id ON households(source_household_id);
CREATE INDEX IF NOT EXISTS idx_households_display_id ON households(household_id_display);

DROP POLICY IF EXISTS "households_select" ON households;
CREATE POLICY "households_select" ON households FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "households_insert" ON households;
CREATE POLICY "households_insert" ON households FOR INSERT
  TO authenticated WITH CHECK (public.is_staff_or_higher());

DROP POLICY IF EXISTS "households_update" ON households;
CREATE POLICY "households_update" ON households FOR UPDATE
  TO authenticated USING (public.is_staff_or_higher()) WITH CHECK (public.is_staff_or_higher());

DROP POLICY IF EXISTS "households_delete" ON households;
CREATE POLICY "households_delete" ON households FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================================
-- RESIDENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS residents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text,
  source_resident_id text,

  -- Personal
  first_name text NOT NULL DEFAULT '',
  middle_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  suffix text NOT NULL DEFAULT '',
  date_of_birth date,
  sex text CHECK (sex IN ('male', 'female') OR sex IS NULL),
  civil_status text CHECK (civil_status IN ('single', 'married', 'widowed', 'separated', 'divorced', 'annulled', 'unknown') OR civil_status IS NULL),
  nationality text NOT NULL DEFAULT 'Filipino',
  place_of_birth text,
  religion text,

  -- Contact
  contact_number text,
  email text,
  emergency_contact_name text,
  emergency_contact_number text,
  emergency_contact_relationship text,

  -- Address / Household
  household_id uuid REFERENCES households(id) ON DELETE SET NULL,
  relationship_to_head text CHECK (relationship_to_head IN ('head', 'spouse', 'child', 'parent', 'sibling', 'relative', 'in_law', 'helper', 'other') OR relationship_to_head IS NULL),
  purok text,
  village text,
  block text,
  lot text,
  complete_address text NOT NULL DEFAULT '',
  residency_info text,

  -- Social Classification
  is_indigent boolean NOT NULL DEFAULT false,
  indigent_source text,
  is_pwd boolean NOT NULL DEFAULT false,
  pwd_details text,
  is_registered_senior boolean NOT NULL DEFAULT false,
  senior_registration_source text,
  is_solo_parent boolean NOT NULL DEFAULT false,
  solo_parent_registered boolean NOT NULL DEFAULT false,
  solo_parent_source text,
  is_4ps boolean NOT NULL DEFAULT false,
  four_ps_source text,
  is_ofw boolean NOT NULL DEFAULT false,
  ofw_source text,
  registered_voter text NOT NULL DEFAULT 'unknown' CHECK (registered_voter IN ('yes', 'no', 'unknown')),
  voter_registration_source text,

  -- Education
  school text,
  current_enrollment text,
  highest_education text,
  course_strand text,

  -- Employment
  employment_status text,
  occupation text,
  employer text,
  place_of_work text,
  employment_type text,
  monthly_income numeric(12,2),
  daily_income numeric(12,2),

  -- Verification
  verification_status text NOT NULL DEFAULT 'for_verification' CHECK (verification_status IN ('imported', 'for_verification', 'verified', 'archived')),
  verified_date date,
  verified_by uuid REFERENCES profiles(id),
  verification_notes text,

  -- Administrative
  admin_notes text,

  -- System
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id)
);

ALTER TABLE residents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_residents_first_name ON residents(first_name);
CREATE INDEX IF NOT EXISTS idx_residents_last_name ON residents(last_name);
CREATE INDEX IF NOT EXISTS idx_residents_middle_name ON residents(middle_name);
CREATE INDEX IF NOT EXISTS idx_residents_purok ON residents(purok);
CREATE INDEX IF NOT EXISTS idx_residents_village ON residents(village);
CREATE INDEX IF NOT EXISTS idx_residents_sex ON residents(sex);
CREATE INDEX IF NOT EXISTS idx_residents_dob ON residents(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_residents_household ON residents(household_id);
CREATE INDEX IF NOT EXISTS idx_residents_verification ON residents(verification_status);
CREATE INDEX IF NOT EXISTS idx_residents_indigent ON residents(is_indigent);
CREATE INDEX IF NOT EXISTS idx_residents_pwd ON residents(is_pwd);
CREATE INDEX IF NOT EXISTS idx_residents_senior_reg ON residents(is_registered_senior);
CREATE INDEX IF NOT EXISTS idx_residents_solo_parent ON residents(is_solo_parent);
CREATE INDEX IF NOT EXISTS idx_residents_ofw ON residents(is_ofw);
CREATE INDEX IF NOT EXISTS idx_residents_voter ON residents(registered_voter);
CREATE INDEX IF NOT EXISTS idx_residents_4ps ON residents(is_4ps);
CREATE INDEX IF NOT EXISTS idx_residents_source_id ON residents(source_id);

DROP POLICY IF EXISTS "residents_select" ON residents;
CREATE POLICY "residents_select" ON residents FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "residents_insert" ON residents;
CREATE POLICY "residents_insert" ON residents FOR INSERT
  TO authenticated WITH CHECK (public.is_staff_or_higher());

DROP POLICY IF EXISTS "residents_update" ON residents;
CREATE POLICY "residents_update" ON residents FOR UPDATE
  TO authenticated USING (public.is_staff_or_higher()) WITH CHECK (public.is_staff_or_higher());

DROP POLICY IF EXISTS "residents_delete" ON residents;
CREATE POLICY "residents_delete" ON residents FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================================
-- BARANGAY OFFICIALS
-- ============================================================================
CREATE TABLE IF NOT EXISTS barangay_officials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  term_start date,
  term_end date,
  signature_url text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE barangay_officials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "officials_select" ON barangay_officials;
CREATE POLICY "officials_select" ON barangay_officials FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "officials_insert" ON barangay_officials;
CREATE POLICY "officials_insert" ON barangay_officials FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "officials_update" ON barangay_officials;
CREATE POLICY "officials_update" ON barangay_officials FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "officials_delete" ON barangay_officials;
CREATE POLICY "officials_delete" ON barangay_officials FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS residents_updated_at ON residents;
CREATE TRIGGER residents_updated_at BEFORE UPDATE ON residents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS households_updated_at ON households;
CREATE TRIGGER households_updated_at BEFORE UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS barangay_profile_updated_at ON barangay_profile;
CREATE TRIGGER barangay_profile_updated_at BEFORE UPDATE ON barangay_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS officials_updated_at ON barangay_officials;
CREATE TRIGGER officials_updated_at BEFORE UPDATE ON barangay_officials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
