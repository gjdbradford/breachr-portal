-- portal/supabase/migrations/20260516000000_remediation_foundation.sql

-- ── 1. Add reference_id to audit_logs ─────────────────────────────────────
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reference_id uuid;
CREATE INDEX IF NOT EXISTS idx_audit_logs_reference_id
  ON audit_logs(reference_id) WHERE reference_id IS NOT NULL;

-- ── 2. remediation_batches ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS remediation_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  assigned_to       uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_by        uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  due_date          date,
  priority          text NOT NULL CHECK (priority IN ('critical','high','medium','low')),
  jira_push_enabled bool NOT NULL DEFAULT false,
  status            text NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','completed','archived')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_remediation_batches_tenant
  ON remediation_batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_remediation_batches_assigned
  ON remediation_batches(assigned_to);

ALTER TABLE remediation_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read remediation batches"
  ON remediation_batches FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE supabase_uid = auth.uid())
    AND (
      (SELECT role FROM users WHERE supabase_uid = auth.uid())
        IN ('account_owner','admin')
      OR assigned_to = (SELECT id FROM users WHERE supabase_uid = auth.uid())
    )
  );

-- ── 3. remediation_tasks ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS remediation_tasks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              uuid NOT NULL REFERENCES remediation_batches(id)
                             ON DELETE CASCADE,
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  finding_id            uuid NOT NULL REFERENCES findings(id) ON DELETE RESTRICT,
  assigned_to           uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status                text NOT NULL DEFAULT 'open'
                             CHECK (status IN (
                               'open','in_progress','review_requested',
                               'verified_fixed','failed_verification','reopened'
                             )),
  verification_attempts int NOT NULL DEFAULT 0,
  jira_issue_key        text,
  jira_issue_url        text,
  resolved_by           uuid REFERENCES users(id),
  resolved_at           timestamptz,
  resolution_source     text CHECK (resolution_source IN ('jira','manual','auto_scan')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_remediation_tasks_tenant
  ON remediation_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_remediation_tasks_batch
  ON remediation_tasks(batch_id);
CREATE INDEX IF NOT EXISTS idx_remediation_tasks_assigned
  ON remediation_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_remediation_tasks_status
  ON remediation_tasks(status);

ALTER TABLE remediation_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read remediation tasks"
  ON remediation_tasks FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE supabase_uid = auth.uid())
    AND (
      (SELECT role FROM users WHERE supabase_uid = auth.uid())
        IN ('account_owner','admin')
      OR assigned_to = (SELECT id FROM users WHERE supabase_uid = auth.uid())
    )
  );

-- ── 4. remediation_status_log (insert-only via service role) ─────────────
CREATE TABLE IF NOT EXISTS remediation_status_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             uuid NOT NULL REFERENCES remediation_tasks(id)
                           ON DELETE CASCADE,
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_status         text NOT NULL,
  to_status           text NOT NULL,
  changed_by          uuid REFERENCES users(id),
  source              text NOT NULL
                           CHECK (source IN (
                             'developer','admin','jira_webhook','auto_scan'
                           )),
  note                text,
  scan_result_summary text,
  prev_hash           text NOT NULL DEFAULT '',
  signature           text NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_remediation_status_log_task
  ON remediation_status_log(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_remediation_status_log_tenant
  ON remediation_status_log(tenant_id);

ALTER TABLE remediation_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read status log"
  ON remediation_status_log FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE supabase_uid = auth.uid())
  );

-- ── 5. remediation_ai_sessions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS remediation_ai_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES remediation_tasks(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  messages      jsonb NOT NULL DEFAULT '[]',
  tokens_used   int  NOT NULL DEFAULT 0,
  message_count int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_remediation_ai_sessions_task
  ON remediation_ai_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_remediation_ai_sessions_user_date
  ON remediation_ai_sessions(user_id, created_at DESC);

ALTER TABLE remediation_ai_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own AI sessions, admins read all"
  ON remediation_ai_sessions FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE supabase_uid = auth.uid())
    AND (
      user_id = (SELECT id FROM users WHERE supabase_uid = auth.uid())
      OR (SELECT role FROM users WHERE supabase_uid = auth.uid())
           IN ('account_owner','admin')
    )
  );

-- ── 6. tenant_integrations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_integrations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration           text NOT NULL,
  auth_method           text NOT NULL CHECK (auth_method IN ('oauth','api_token')),
  encrypted_credentials jsonb NOT NULL DEFAULT '{}',
  jira_base_url         text,
  jira_workspace_name   text,
  connected_by          uuid REFERENCES users(id),
  connected_at          timestamptz,
  last_verified_at      timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, integration)
);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant
  ON tenant_integrations(tenant_id);

ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read integration metadata"
  ON tenant_integrations FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE supabase_uid = auth.uid())
    AND (SELECT role FROM users WHERE supabase_uid = auth.uid())
          IN ('account_owner','admin')
  );

-- ── 7. developer_onboarding_progress ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS developer_onboarding_progress (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  completed_at    timestamptz,
  steps_completed text[] NOT NULL DEFAULT '{}',
  UNIQUE(user_id)
);

ALTER TABLE developer_onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users and admins read onboarding progress"
  ON developer_onboarding_progress FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE supabase_uid = auth.uid())
    AND (
      user_id = (SELECT id FROM users WHERE supabase_uid = auth.uid())
      OR (SELECT role FROM users WHERE supabase_uid = auth.uid())
           IN ('account_owner','admin')
    )
  );
