-- portal/supabase/migrations/20260516000001_remediation_foundation_fixes.sql
-- Quality fixes for 20260516000000_remediation_foundation.sql (already applied to staging).
-- This migration must be applied as a new file — do not amend the original.

-- ── Fix 1: CHECK constraints on remediation_status_log status columns ────────
-- from_status and to_status previously accepted any text value.
ALTER TABLE remediation_status_log
  ADD CONSTRAINT remediation_status_log_from_status_check
    CHECK (from_status IN ('open','in_progress','review_requested','verified_fixed','failed_verification','reopened')),
  ADD CONSTRAINT remediation_status_log_to_status_check
    CHECK (to_status IN ('open','in_progress','review_requested','verified_fixed','failed_verification','reopened'));

-- ── Fix 2: Correct unique constraint on developer_onboarding_progress ────────
-- UNIQUE(user_id) was too broad — a user can have progress records per tenant.
ALTER TABLE developer_onboarding_progress
  DROP CONSTRAINT developer_onboarding_progress_user_id_key;
ALTER TABLE developer_onboarding_progress
  ADD CONSTRAINT developer_onboarding_progress_user_tenant_key UNIQUE (user_id, tenant_id);

-- ── Fix 3: updated_at triggers ───────────────────────────────────────────────
-- These tables have updated_at columns but no trigger to keep them current.
-- set_updated_at() already exists in the database.
CREATE TRIGGER remediation_batches_updated_at
  BEFORE UPDATE ON remediation_batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER remediation_tasks_updated_at
  BEFORE UPDATE ON remediation_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER remediation_ai_sessions_updated_at
  BEFORE UPDATE ON remediation_ai_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Fix 4: CHECK constraint on tenant_integrations.integration ───────────────
-- Constrain to known integrations; expand in future migrations as needed.
ALTER TABLE tenant_integrations
  ADD CONSTRAINT tenant_integrations_integration_check
    CHECK (integration IN ('jira'));

-- ── Fix 5: Replace low-cardinality status index with composite ───────────────
-- idx_remediation_tasks_status (status only) has poor selectivity.
-- Composite (tenant_id, status) is far more useful for tenant-scoped queries.
DROP INDEX IF EXISTS idx_remediation_tasks_status;
CREATE INDEX IF NOT EXISTS idx_remediation_tasks_tenant_status
  ON remediation_tasks(tenant_id, status);
