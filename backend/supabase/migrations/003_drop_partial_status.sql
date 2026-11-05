-- Drop legacy "partial" status; in-progress work uses "uploading".

UPDATE public.reports
SET status = 'uploading'
WHERE status = 'partial';

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_status_check
  CHECK (status IN ('pending', 'uploading', 'delivered', 'failed'));
