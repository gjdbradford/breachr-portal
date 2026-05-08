-- portal/supabase/migrations/20260508_pagination_indexes.sql

-- findings: all filter/sort combos used on Findings page
CREATE INDEX IF NOT EXISTS idx_findings_tenant_created
  ON findings (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_tenant_severity
  ON findings (tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_findings_tenant_status
  ON findings (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_findings_tenant_scan
  ON findings (tenant_id, scan_id);

-- assets: inventory list (risk_score DESC) + active filter
CREATE INDEX IF NOT EXISTS idx_assets_tenant_risk
  ON assets (tenant_id, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_assets_tenant_active
  ON assets (tenant_id, is_active);

-- asset_ports: port count join per asset
CREATE INDEX IF NOT EXISTS idx_asset_ports_asset
  ON asset_ports (asset_id);

-- audit_logs: action-filtered view (tenant+time index already exists)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action_created
  ON audit_logs (tenant_id, action, created_at DESC);
