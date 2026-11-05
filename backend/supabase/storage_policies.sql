-- Applied by: npm run setup:supabase
-- Bucket name is substituted from SUPABASE_STORAGE_BUCKET.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  '{{BUCKET}}',
  '{{BUCKET}}',
  false,
  5242880
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "field_reports_select" ON storage.objects;
DROP POLICY IF EXISTS "field_reports_insert" ON storage.objects;
DROP POLICY IF EXISTS "field_reports_update" ON storage.objects;
DROP POLICY IF EXISTS "field_reports_delete" ON storage.objects;

CREATE POLICY "field_reports_select"
ON storage.objects
FOR SELECT
TO anon, authenticated, service_role
USING (bucket_id = '{{BUCKET}}');

CREATE POLICY "field_reports_insert"
ON storage.objects
FOR INSERT
TO anon, authenticated, service_role
WITH CHECK (bucket_id = '{{BUCKET}}');

CREATE POLICY "field_reports_update"
ON storage.objects
FOR UPDATE
TO anon, authenticated, service_role
USING (bucket_id = '{{BUCKET}}')
WITH CHECK (bucket_id = '{{BUCKET}}');

CREATE POLICY "field_reports_delete"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = '{{BUCKET}}');
