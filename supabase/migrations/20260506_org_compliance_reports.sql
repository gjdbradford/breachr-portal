-- ============================================================
-- IMPORTANT: Run this migration manually in the Supabase SQL editor.
-- ============================================================
--
-- compliance_reports: support organisational (multi-scan) reports
-- report_type: 'scan' = legacy per-scan (default), 'organizational' = new holistic
ALTER TABLE compliance_reports
  ADD COLUMN IF NOT EXISTS report_type       text NOT NULL DEFAULT 'scan',
  ADD COLUMN IF NOT EXISTS report_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS report_period_end   timestamptz,
  ADD COLUMN IF NOT EXISTS scan_ids          uuid[],
  ADD COLUMN IF NOT EXISTS scan_count        integer,
  ADD COLUMN IF NOT EXISTS targets_covered   jsonb;   -- [{id, name, url}]

-- Make scan_id nullable — org reports have no single scan
ALTER TABLE compliance_reports
  ALTER COLUMN scan_id DROP NOT NULL;

-- Index for the new default query (org reports, newest first)
CREATE INDEX IF NOT EXISTS idx_compliance_reports_org
  ON compliance_reports (tenant_id, report_type, created_at DESC);
