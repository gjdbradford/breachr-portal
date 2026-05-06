-- compliance_reports: PDF signing columns
ALTER TABLE compliance_reports
  ADD COLUMN IF NOT EXISTS pdf_hash         text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz;
