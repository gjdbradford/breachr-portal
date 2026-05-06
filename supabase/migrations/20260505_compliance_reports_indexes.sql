-- Primary query pattern: all reports for a tenant, newest first
CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant_created
  ON compliance_reports (tenant_id, created_at DESC);

-- Framework filter
CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant_framework
  ON compliance_reports (tenant_id, framework);

-- Status filter (ready vs generating)
CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant_status
  ON compliance_reports (tenant_id, status);
