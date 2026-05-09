-- Per-user permission overrides (account_owner can restrict admin members)
-- Defaults to empty object = all defaults apply (see portal/lib/permissions.ts)
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}';

-- Index for efficient audit log tail queries (chain-of-custody prev_hash lookup)
CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx
  ON audit_logs (tenant_id, created_at DESC);
