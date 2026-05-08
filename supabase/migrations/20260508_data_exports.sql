CREATE TABLE IF NOT EXISTS data_exports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id),
  requested_by  uuid        NOT NULL REFERENCES auth.users(id),
  data_type     text        NOT NULL CHECK (data_type IN ('findings', 'inventory', 'audit_trail')),
  format        text        NOT NULL CHECK (format IN ('csv', 'xlsx')),
  filters       jsonb       NOT NULL DEFAULT '{}',
  status        text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'expired')),
  file_path     text,
  row_count     integer,
  error_msg     text,
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_data_exports_tenant_created
  ON data_exports (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_exports_pending
  ON data_exports (status) WHERE status = 'pending';

ALTER TABLE data_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY data_exports_tenant_select ON data_exports
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
