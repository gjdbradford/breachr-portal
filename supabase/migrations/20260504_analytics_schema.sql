-- ============================================================
-- Breachr Analytics Schema Migration
-- Adds full product metrics tracking capability
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. users: superuser flag + session tracking
-- ─────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_superuser        bool         DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at       timestamptz,
  ADD COLUMN IF NOT EXISTS login_count         int          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- ─────────────────────────────────────────────
-- 2. tenants: activation, engagement, config
-- ─────────────────────────────────────────────
ALTER TABLE tenants
  -- Activation funnel timestamps
  ADD COLUMN IF NOT EXISTS first_target_at         timestamptz,   -- when first attack_surface created
  ADD COLUMN IF NOT EXISTS first_scan_at           timestamptz,   -- when first scan launched
  ADD COLUMN IF NOT EXISTS activated_at            timestamptz,   -- when first scan COMPLETED (TTV)
  ADD COLUMN IF NOT EXISTS last_scan_at            timestamptz,   -- updated on every scan completion
  ADD COLUMN IF NOT EXISTS last_login_at           timestamptz,   -- updated on every user login

  -- Revenue
  ADD COLUMN IF NOT EXISTS mrr_eur                 numeric(10,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_started_at         timestamptz,   -- when current plan began
  ADD COLUMN IF NOT EXISTS lifetime_revenue_eur    numeric(10,2)  DEFAULT 0,

  -- Profile / segmentation
  ADD COLUMN IF NOT EXISTS industry               text,
  ADD COLUMN IF NOT EXISTS company_size           text,           -- '1-10','11-50','51-200','201-1000','1000+'
  ADD COLUMN IF NOT EXISTS compliance_frameworks  text[]  DEFAULT '{}',  -- ['DORA','NIS2','PCI-DSS','HIPAA','ISO27001']
  ADD COLUMN IF NOT EXISTS country                text,
  ADD COLUMN IF NOT EXISTS referral_source        text,           -- 'organic','linkedin','partner','conference'

  -- Engagement health
  ADD COLUMN IF NOT EXISTS churn_risk_score        numeric(4,2)  DEFAULT 0,  -- 0-100, computed periodically
  ADD COLUMN IF NOT EXISTS total_scans_all_time    int           DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_findings_all_time int           DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_tokens_all_time   bigint        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost_usd_all_time numeric(10,4) DEFAULT 0,

  -- Enterprise configuration
  ADD COLUMN IF NOT EXISTS is_enterprise_managed   bool          DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_concurrent_scans    int           DEFAULT 1,
  ADD COLUMN IF NOT EXISTS environments            jsonb         DEFAULT '[]',
  -- e.g. [{"name":"Production","url":"https://app.co","type":"webapp"},{"name":"Staging",...}]

  -- Cancellation
  ADD COLUMN IF NOT EXISTS cancelled_at            timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason     text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text;

-- ─────────────────────────────────────────────
-- 3. scans: operational + AI metrics
-- ─────────────────────────────────────────────
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS queue_wait_ms       int,    -- ms from created_at → started_at
  ADD COLUMN IF NOT EXISTS probe_duration_ms   int,    -- ms for phase 1 (reconnaissance)
  ADD COLUMN IF NOT EXISTS analysis_duration_ms int,   -- ms for phase 3 (AI analysis)
  ADD COLUMN IF NOT EXISTS total_duration_ms   int,    -- ms from started_at → completed_at
  ADD COLUMN IF NOT EXISTS error_type          text,   -- 'timeout','auth_error','target_unreachable','ai_error'
  ADD COLUMN IF NOT EXISTS error_message       text,
  ADD COLUMN IF NOT EXISTS findings_count      int     DEFAULT 0,  -- denormalised for fast queries
  ADD COLUMN IF NOT EXISTS critical_count      int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS high_count          int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medium_count        int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_count           int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS false_positive_count int    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prompt_cache_hit    bool,   -- did Claude prompt cache fire?
  ADD COLUMN IF NOT EXISTS ai_latency_ms       int;    -- Claude API response time

-- ─────────────────────────────────────────────
-- 4. findings: lifecycle + quality tracking
-- ─────────────────────────────────────────────
ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS false_positive         bool          DEFAULT false,
  ADD COLUMN IF NOT EXISTS false_positive_at      timestamptz,
  ADD COLUMN IF NOT EXISTS false_positive_by      uuid,         -- user who marked it
  ADD COLUMN IF NOT EXISTS viewed_at              timestamptz,  -- first time finding was opened
  ADD COLUMN IF NOT EXISTS remediated_at          timestamptz,  -- when status → remediated
  ADD COLUMN IF NOT EXISTS days_to_remediate      int,          -- computed: remediated_at - created_at
  ADD COLUMN IF NOT EXISTS recurrence_count       int  DEFAULT 0;  -- times same vuln found before

-- ─────────────────────────────────────────────
-- 5. events: universal product telemetry
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid         REFERENCES tenants(id) ON DELETE SET NULL,
  user_id      uuid,                          -- auth.users id (not FK — users may be deleted)
  session_id   text,                          -- client-side UUID per browser session
  event        text         NOT NULL,         -- namespaced: 'page.view', 'scan.launched', etc.
  properties   jsonb        DEFAULT '{}',     -- arbitrary event data
  url          text,                          -- page path at time of event
  referrer     text,
  user_agent   text,
  ip_hash      text,                          -- SHA-256 of IP — GDPR-safe geolocation
  created_at   timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_tenant_id_idx   ON events(tenant_id);
CREATE INDEX IF NOT EXISTS events_event_idx        ON events(event);
CREATE INDEX IF NOT EXISTS events_created_at_idx   ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS events_user_id_idx      ON events(user_id);

-- RLS: only superusers and the owning tenant can read events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can read own events" ON events
  FOR SELECT USING (tenant_id = (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Service role full access to events" ON events
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 6. subscription_events: revenue lifecycle log
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_events (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid         REFERENCES tenants(id) ON DELETE SET NULL,
  event_type      text         NOT NULL,   -- 'trialled','upgraded','downgraded','cancelled','payment_failed','payment_recovered'
  from_plan       text,
  to_plan         text,
  mrr_delta_eur   numeric(10,2),           -- +ve = expansion, -ve = contraction/churn
  mrr_after_eur   numeric(10,2),           -- MRR after this event
  billing_period  text,                    -- 'monthly' | 'annual'
  stripe_event_id text         UNIQUE,
  stripe_invoice_id text,
  created_at      timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sub_events_tenant_idx     ON subscription_events(tenant_id);
CREATE INDEX IF NOT EXISTS sub_events_type_idx       ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS sub_events_created_at_idx ON subscription_events(created_at DESC);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
-- Superuser only — no tenant self-service
CREATE POLICY "Service role full access to subscription_events" ON subscription_events
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 7. ai_training_context: founder AI training
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_training_context (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text         NOT NULL,
  category     text         NOT NULL,    -- 'probe_rules','vulnerability_types','remediation_templates','system_prompt'
  content      text         NOT NULL,
  enabled      bool         DEFAULT true,
  version      int          DEFAULT 1,
  notes        text,
  created_by   uuid,
  updated_by   uuid,
  created_at   timestamptz  DEFAULT now(),
  updated_at   timestamptz  DEFAULT now()
);

ALTER TABLE ai_training_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to ai_training_context" ON ai_training_context
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 8. Useful computed views for the admin dashboard
-- ─────────────────────────────────────────────

-- Funnel view: where each tenant is in the activation journey
CREATE OR REPLACE VIEW admin_funnel AS
WITH funnel AS (
  SELECT
    t.id,
    t.created_at                                                    AS registered_at,
    t.first_target_at,
    t.first_scan_at,
    t.activated_at,                                                  -- first scan completed
    t.plan,
    t.mrr_eur,
    t.last_login_at,
    t.last_scan_at,
    t.churn_risk_score,
    CASE
      WHEN t.activated_at  IS NOT NULL THEN 'activated'
      WHEN t.first_scan_at IS NOT NULL THEN 'scanned'
      WHEN t.first_target_at IS NOT NULL THEN 'targeted'
      ELSE 'registered'
    END                                                              AS funnel_stage,
    EXTRACT(EPOCH FROM (t.first_target_at - t.created_at))/60       AS mins_to_first_target,
    EXTRACT(EPOCH FROM (t.first_scan_at   - t.created_at))/60       AS mins_to_first_scan,
    EXTRACT(EPOCH FROM (t.activated_at    - t.created_at))/60       AS mins_to_activation,
    EXTRACT(EPOCH FROM (now() - t.last_login_at))/86400             AS days_since_login,
    EXTRACT(EPOCH FROM (now() - t.last_scan_at))/86400              AS days_since_scan
  FROM tenants t
)
SELECT * FROM funnel;

-- MRR view: current revenue breakdown
CREATE OR REPLACE VIEW admin_mrr AS
SELECT
  plan,
  COUNT(*)                                            AS tenant_count,
  SUM(mrr_eur)                                        AS mrr_eur,
  SUM(mrr_eur) * 12                                   AS arr_eur,
  AVG(mrr_eur)                                        AS arpu_eur,
  SUM(total_scans_all_time)                           AS total_scans,
  SUM(total_tokens_all_time)                          AS total_tokens,
  SUM(total_cost_usd_all_time)                        AS total_ai_cost_usd
FROM tenants
WHERE plan != 'free'
GROUP BY plan;

-- Scan performance view: AI cost efficiency
CREATE OR REPLACE VIEW admin_scan_metrics AS
SELECT
  DATE_TRUNC('day', s.created_at)                    AS scan_date,
  s.scan_type,
  s.model_used,
  COUNT(*)                                           AS scan_count,
  COUNT(*) FILTER (WHERE s.status = 'complete')      AS completed,
  COUNT(*) FILTER (WHERE s.status = 'failed')        AS failed,
  ROUND(AVG(s.total_duration_ms)/1000)               AS avg_duration_secs,
  ROUND(AVG(s.tokens_input + s.tokens_output))       AS avg_tokens,
  ROUND(AVG(s.cost_usd)::numeric, 4)                 AS avg_cost_usd,
  ROUND(AVG(s.findings_count))                       AS avg_findings,
  ROUND(
    SUM(s.cost_usd) / NULLIF(SUM(s.findings_count),0)::numeric,
    4
  )                                                  AS cost_per_finding_usd
FROM scans s
GROUP BY 1, 2, 3
ORDER BY 1 DESC;

-- Finding quality view: MTTR + false positive rates
CREATE OR REPLACE VIEW admin_finding_quality AS
SELECT
  DATE_TRUNC('month', f.created_at)                  AS month,
  f.severity,
  COUNT(*)                                           AS total_findings,
  COUNT(*) FILTER (WHERE f.false_positive)           AS false_positives,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE f.false_positive) / NULLIF(COUNT(*), 0)
  )                                                  AS false_positive_pct,
  COUNT(*) FILTER (WHERE f.status = 'remediated')    AS remediated,
  ROUND(AVG(f.days_to_remediate))                    AS avg_days_to_remediate,
  ROUND(AVG(f.ai_confidence))                        AS avg_ai_confidence
FROM findings f
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- ─────────────────────────────────────────────
-- 9. Trigger: auto-update days_to_remediate
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_remediation_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'remediated' AND OLD.status != 'remediated' THEN
    NEW.remediated_at = now();
    NEW.days_to_remediate = EXTRACT(DAY FROM (now() - NEW.created_at))::int;
  END IF;
  IF NEW.false_positive = true AND OLD.false_positive = false THEN
    NEW.false_positive_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS findings_remediation_trigger ON findings;
CREATE TRIGGER findings_remediation_trigger
  BEFORE UPDATE ON findings
  FOR EACH ROW EXECUTE FUNCTION set_remediation_timestamp();

-- ─────────────────────────────────────────────
-- 10. Trigger: keep tenant aggregate stats fresh
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_tenant_scan_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'complete' AND (OLD.status IS NULL OR OLD.status != 'complete') THEN
    UPDATE tenants SET
      total_scans_all_time    = COALESCE(total_scans_all_time, 0) + 1,
      total_tokens_all_time   = COALESCE(total_tokens_all_time, 0) + COALESCE(NEW.tokens_input,0) + COALESCE(NEW.tokens_output,0),
      total_cost_usd_all_time = COALESCE(total_cost_usd_all_time, 0) + COALESCE(NEW.cost_usd, 0),
      last_scan_at            = now(),
      activated_at            = COALESCE(activated_at, now())
    WHERE id = NEW.tenant_id;

    -- Record duration
    IF NEW.started_at IS NOT NULL THEN
      UPDATE scans SET
        total_duration_ms = EXTRACT(EPOCH FROM (now() - NEW.started_at))::int * 1000
      WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scans_completion_trigger ON scans;
CREATE TRIGGER scans_completion_trigger
  AFTER UPDATE ON scans
  FOR EACH ROW EXECUTE FUNCTION update_tenant_scan_stats();

-- ─────────────────────────────────────────────
-- 11. Trigger: track first_target_at on tenants
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION track_first_target()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE tenants SET
    first_target_at = COALESCE(first_target_at, now())
  WHERE id = NEW.tenant_id AND first_target_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attack_surfaces_first_target_trigger ON attack_surfaces;
CREATE TRIGGER attack_surfaces_first_target_trigger
  AFTER INSERT ON attack_surfaces
  FOR EACH ROW EXECUTE FUNCTION track_first_target();

-- ─────────────────────────────────────────────
-- 12. Trigger: track first_scan_at on tenants
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION track_first_scan()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE tenants SET
    first_scan_at = COALESCE(first_scan_at, now())
  WHERE id = NEW.tenant_id AND first_scan_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scans_first_scan_trigger ON scans;
CREATE TRIGGER scans_first_scan_trigger
  AFTER INSERT ON scans
  FOR EACH ROW EXECUTE FUNCTION track_first_scan();

-- ─────────────────────────────────────────────
-- 13. Realtime: expose new tables
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- ─────────────────────────────────────────────
-- 14. Backfill existing data from current records
-- ─────────────────────────────────────────────

-- Backfill total_scans_all_time from existing scans
UPDATE tenants t SET
  total_scans_all_time = (
    SELECT COUNT(*) FROM scans s
    WHERE s.tenant_id = t.id AND s.status = 'complete'
  ),
  total_tokens_all_time = (
    SELECT COALESCE(SUM(COALESCE(tokens_input,0) + COALESCE(tokens_output,0)), 0)
    FROM scans s WHERE s.tenant_id = t.id AND s.status = 'complete'
  ),
  total_cost_usd_all_time = (
    SELECT COALESCE(SUM(COALESCE(cost_usd,0)), 0)
    FROM scans s WHERE s.tenant_id = t.id AND s.status = 'complete'
  ),
  last_scan_at = (
    SELECT MAX(completed_at) FROM scans s
    WHERE s.tenant_id = t.id AND s.status = 'complete'
  ),
  activated_at = (
    SELECT MIN(completed_at) FROM scans s
    WHERE s.tenant_id = t.id AND s.status = 'complete'
  ),
  first_scan_at = (
    SELECT MIN(created_at) FROM scans s WHERE s.tenant_id = t.id
  ),
  first_target_at = (
    SELECT MIN(created_at) FROM attack_surfaces a WHERE a.tenant_id = t.id
  );

-- Backfill findings_count on scans
UPDATE scans s SET
  findings_count  = (SELECT COUNT(*)   FROM findings f WHERE f.scan_id = s.id),
  critical_count  = (SELECT COUNT(*)   FROM findings f WHERE f.scan_id = s.id AND f.severity = 'critical'),
  high_count      = (SELECT COUNT(*)   FROM findings f WHERE f.scan_id = s.id AND f.severity = 'high'),
  medium_count    = (SELECT COUNT(*)   FROM findings f WHERE f.scan_id = s.id AND f.severity = 'medium'),
  low_count       = (SELECT COUNT(*)   FROM findings f WHERE f.scan_id = s.id AND f.severity = 'low');

-- Backfill total_findings_all_time on tenants
UPDATE tenants t SET
  total_findings_all_time = (
    SELECT COUNT(*) FROM findings f WHERE f.tenant_id = t.id
  );

-- Backfill MRR from current plan
UPDATE tenants SET mrr_eur = CASE plan
  WHEN 'starter'      THEN 159
  WHEN 'professional' THEN 350
  WHEN 'enterprise'   THEN 15000
  ELSE 0
END;
