-- Align report and attachment status constraints.

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_status_check
  CHECK (status IN ('pending', 'uploading', 'delivered', 'failed'));

ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS attachments_status_check;
ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_status_check
  CHECK (status IN ('pending', 'uploading', 'uploaded', 'failed'));

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Hard 5 MB ceiling at the destination (< 5 MiB)
ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS attachments_size_bytes_check;
ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_size_bytes_check
  CHECK (size_bytes > 0 AND size_bytes < 5242880);
