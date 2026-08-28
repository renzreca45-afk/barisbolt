/*
# Storage bucket policies for barangay-assets

1. Creates policies for the barangay-assets storage bucket (public read, authenticated write)
2. Allows authenticated users to upload/replace/delete assets
3. Public read access for asset URLs
*/

-- Public read access for barangay-assets bucket
DROP POLICY IF EXISTS "assets_public_read" ON storage.objects;
CREATE POLICY "assets_public_read" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'barangay-assets');

-- Authenticated users can upload
DROP POLICY IF EXISTS "assets_auth_insert" ON storage.objects;
CREATE POLICY "assets_auth_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'barangay-assets');

-- Authenticated users can update
DROP POLICY IF EXISTS "assets_auth_update" ON storage.objects;
CREATE POLICY "assets_auth_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'barangay-assets') WITH CHECK (bucket_id = 'barangay-assets');

-- Authenticated users can delete
DROP POLICY IF EXISTS "assets_auth_delete" ON storage.objects;
CREATE POLICY "assets_auth_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'barangay-assets');
