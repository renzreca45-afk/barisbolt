/*
# BARIS Secondary Schema — Transactions, Documents, Templates, Assets, Audit Log

## New Tables

### document_types
- Catalog of document types (Certificate of Residency, Indigency, Clearance, etc.)
- Admin-managed: name, code, description, default_fee, is_active, allow_download.

### document_templates
- Visual template definitions stored as JSON (canvas elements, page settings).
- Linked to document_type. Versioned with version_number.

### asset_repository
- Reusable assets: logos, seals, signatures, frames, borders, backgrounds, decorative elements.

### transactions
- Document-related transactions: resident, document_type, purpose, dates, status, OR number, fee, processed_by, notes.

### audit_log
- Records administrative actions. Logging via SECURITY DEFINER function.

## Helper Functions
- calculate_age(dob) — immutable age from DOB
- get_dashboard_stats() — centralized statistics for dashboard and reports

## Security
- RLS on all tables with role-based policies using helper functions from migration 001.
*/

-- ============================================================================
-- DOCUMENT TYPES
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  code text NOT NULL DEFAULT '',
  description text,
  default_fee numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  allow_download boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_types_select" ON document_types;
CREATE POLICY "doc_types_select" ON document_types FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "doc_types_insert" ON document_types;
CREATE POLICY "doc_types_insert" ON document_types FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "doc_types_update" ON document_types;
CREATE POLICY "doc_types_update" ON document_types FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "doc_types_delete" ON document_types;
CREATE POLICY "doc_types_delete" ON document_types FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================================
-- DOCUMENT TEMPLATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id uuid REFERENCES document_types(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  template_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  version_number int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  updated_by uuid REFERENCES profiles(id)
);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_select" ON document_templates;
CREATE POLICY "templates_select" ON document_templates FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "templates_insert" ON document_templates;
CREATE POLICY "templates_insert" ON document_templates FOR INSERT
  TO authenticated WITH CHECK (public.is_staff_or_higher());

DROP POLICY IF EXISTS "templates_update" ON document_templates;
CREATE POLICY "templates_update" ON document_templates FOR UPDATE
  TO authenticated USING (public.is_staff_or_higher()) WITH CHECK (public.is_staff_or_higher());

DROP POLICY IF EXISTS "templates_delete" ON document_templates;
CREATE POLICY "templates_delete" ON document_templates FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================================
-- ASSET REPOSITORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_repository (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'logo' CHECK (category IN ('logo', 'seal', 'signature', 'frame', 'border', 'background', 'decorative', 'other')),
  url text NOT NULL DEFAULT '',
  description text,
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

ALTER TABLE asset_repository ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_select" ON asset_repository;
CREATE POLICY "assets_select" ON asset_repository FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "assets_insert" ON asset_repository;
CREATE POLICY "assets_insert" ON asset_repository FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "assets_update" ON asset_repository;
CREATE POLICY "assets_update" ON asset_repository FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "assets_delete" ON asset_repository;
CREATE POLICY "assets_delete" ON asset_repository FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================================
-- TRANSACTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid REFERENCES residents(id) ON DELETE SET NULL,
  document_type_id uuid REFERENCES document_types(id) ON DELETE SET NULL,
  template_id uuid REFERENCES document_templates(id) ON DELETE SET NULL,
  purpose text NOT NULL DEFAULT '',
  date_requested date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'ready', 'released', 'cancelled')),
  or_number text,
  fee numeric(12,2) NOT NULL DEFAULT 0,
  processed_by uuid REFERENCES profiles(id),
  released_date date,
  notes text,
  resident_snapshot jsonb,
  custom_fields jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_transactions_resident ON transactions(resident_id);
CREATE INDEX IF NOT EXISTS idx_transactions_doc_type ON transactions(document_type_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date_requested);
CREATE INDEX IF NOT EXISTS idx_transactions_or_number ON transactions(or_number);

DROP POLICY IF EXISTS "transactions_select" ON transactions;
CREATE POLICY "transactions_select" ON transactions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "transactions_insert" ON transactions;
CREATE POLICY "transactions_insert" ON transactions FOR INSERT
  TO authenticated WITH CHECK (public.is_staff_or_higher());

DROP POLICY IF EXISTS "transactions_update" ON transactions;
CREATE POLICY "transactions_update" ON transactions FOR UPDATE
  TO authenticated USING (public.is_staff_or_higher()) WITH CHECK (public.is_staff_or_higher());

DROP POLICY IF EXISTS "transactions_delete" ON transactions;
CREATE POLICY "transactions_delete" ON transactions FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================================
-- AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  user_name text,
  action text NOT NULL DEFAULT '',
  record_type text,
  record_id text,
  description text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT
  TO authenticated USING (public.is_staff_or_higher());

CREATE OR REPLACE FUNCTION public.log_audit(
  p_action text,
  p_record_type text DEFAULT NULL,
  p_record_id text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_name text;
BEGIN
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;
  INSERT INTO public.audit_log (user_id, user_name, action, record_type, record_id, description, metadata)
  VALUES (v_user_id, v_user_name, p_action, p_record_type, p_record_id, p_description, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, text, jsonb) TO authenticated;

-- ============================================================================
-- STATISTICS HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_age(dob date)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXTRACT(YEAR FROM age(CURRENT_DATE, dob))::int;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_age(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'total_households', (SELECT count(*) FROM households),
    'total_residents', (SELECT count(*) FROM residents WHERE verification_status != 'archived'),
    'male', (SELECT count(*) FROM residents WHERE sex = 'male' AND verification_status != 'archived'),
    'female', (SELECT count(*) FROM residents WHERE sex = 'female' AND verification_status != 'archived'),
    'pwd', (SELECT count(*) FROM residents WHERE is_pwd = true AND verification_status != 'archived'),
    'indigent', (SELECT count(*) FROM residents WHERE is_indigent = true AND verification_status != 'archived'),
    'senior_citizens', (SELECT count(*) FROM residents WHERE date_of_birth IS NOT NULL AND public.calculate_age(date_of_birth) >= 60 AND verification_status != 'archived'),
    'registered_seniors', (SELECT count(*) FROM residents WHERE is_registered_senior = true AND verification_status != 'archived'),
    'solo_parents', (SELECT count(*) FROM residents WHERE is_solo_parent = true AND verification_status != 'archived'),
    'ofws', (SELECT count(*) FROM residents WHERE is_ofw = true AND verification_status != 'archived'),
    'registered_voters', (SELECT count(*) FROM residents WHERE registered_voter = 'yes' AND verification_status != 'archived'),
    'by_purok', (
      SELECT COALESCE(jsonb_object_agg(purok, cnt), '{}'::jsonb)
      FROM (
        SELECT COALESCE(NULLIF(purok, ''), 'Unassigned') AS purok, count(*) AS cnt
        FROM residents WHERE verification_status != 'archived'
        GROUP BY purok
      ) t
    ),
    'by_village', (
      SELECT COALESCE(jsonb_object_agg(village, cnt), '{}'::jsonb)
      FROM (
        SELECT COALESCE(NULLIF(village, ''), 'Unassigned') AS village, count(*) AS cnt
        FROM residents WHERE verification_status != 'archived'
        GROUP BY village
      ) t
    ),
    'recent_transactions', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      FROM (
        SELECT tr.id, tr.purpose, tr.status, tr.date_requested, tr.or_number, tr.fee,
               dt.name AS document_type_name,
               CONCAT_WS(' ', r.first_name, r.last_name) AS resident_name,
               tr.created_at
        FROM transactions tr
        LEFT JOIN document_types dt ON tr.document_type_id = dt.id
        LEFT JOIN residents r ON tr.resident_id = r.id
        ORDER BY tr.created_at DESC
        LIMIT 10
      ) t
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

-- ============================================================================
-- UPDATED_AT TRIGGERS for new tables
-- ============================================================================
DROP TRIGGER IF EXISTS doc_types_updated_at ON document_types;
CREATE TRIGGER doc_types_updated_at BEFORE UPDATE ON document_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS templates_updated_at ON document_templates;
CREATE TRIGGER templates_updated_at BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS assets_updated_at ON asset_repository;
CREATE TRIGGER assets_updated_at BEFORE UPDATE ON asset_repository
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS transactions_updated_at ON transactions;
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
