-- ============================================================
-- Production Migration: Constraints, Functions, RLS, Triggers
-- Apply AFTER 00_base_schema.sql
-- ============================================================

-- ── 0. Fix admin_ views (were created as tables by 00_base_schema.sql) ────────

DROP TABLE IF EXISTS admin_funnel;
DROP TABLE IF EXISTS admin_mrr;
DROP TABLE IF EXISTS admin_scan_metrics;
DROP TABLE IF EXISTS admin_finding_quality;

-- ── 1. Sequences ──────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS audit_logs_id_seq AS bigint;
ALTER TABLE audit_logs ALTER COLUMN id SET DEFAULT nextval('audit_logs_id_seq');

-- ── 2. Primary Keys ───────────────────────────────────────────────────────────

ALTER TABLE tenants               ADD PRIMARY KEY (id);
ALTER TABLE cve_cache             ADD PRIMARY KEY (cve_id);
ALTER TABLE surveys               ADD PRIMARY KEY (id);
ALTER TABLE users                 ADD PRIMARY KEY (id);
ALTER TABLE subscriptions         ADD PRIMARY KEY (id);
ALTER TABLE subscription_events   ADD PRIMARY KEY (id);
ALTER TABLE token_purchases       ADD PRIMARY KEY (id);
ALTER TABLE cancellations         ADD PRIMARY KEY (id);
ALTER TABLE invitations           ADD PRIMARY KEY (id);
ALTER TABLE enquiries             ADD PRIMARY KEY (id);
ALTER TABLE audit_logs            ADD PRIMARY KEY (id);
ALTER TABLE deletion_requests     ADD PRIMARY KEY (id);
ALTER TABLE deletion_audit_log    ADD PRIMARY KEY (id);
ALTER TABLE sandbox_configs       ADD PRIMARY KEY (id);
ALTER TABLE saved_views           ADD PRIMARY KEY (id);
ALTER TABLE events                ADD PRIMARY KEY (id);
ALTER TABLE survey_dismissals     ADD PRIMARY KEY (id);
ALTER TABLE survey_responses      ADD PRIMARY KEY (id);
ALTER TABLE staff                 ADD PRIMARY KEY (id);
ALTER TABLE assets                ADD PRIMARY KEY (id);
ALTER TABLE scans                 ADD PRIMARY KEY (id);
ALTER TABLE sensors               ADD PRIMARY KEY (id);
ALTER TABLE engagements           ADD PRIMARY KEY (id);
ALTER TABLE findings              ADD PRIMARY KEY (id);
ALTER TABLE asset_ports           ADD PRIMARY KEY (id);
ALTER TABLE asset_vulns           ADD PRIMARY KEY (id);
ALTER TABLE asset_classification_log ADD PRIMARY KEY (id);
ALTER TABLE attack_surfaces       ADD PRIMARY KEY (id);
ALTER TABLE compliance_mappings   ADD PRIMARY KEY (id);
ALTER TABLE compliance_reports    ADD PRIMARY KEY (id);
ALTER TABLE ai_training_context   ADD PRIMARY KEY (id);
ALTER TABLE engagement_phases     ADD PRIMARY KEY (id);
ALTER TABLE engagement_team       ADD PRIMARY KEY (id);
ALTER TABLE engagement_findings   ADD PRIMARY KEY (id);
ALTER TABLE admin_notes           ADD PRIMARY KEY (id);

-- ── 3. Missing columns from later migrations ──────────────────────────────────

-- events: extra columns the track route expects
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS session_id  text,
  ADD COLUMN IF NOT EXISTS url         text,
  ADD COLUMN IF NOT EXISTS referrer    text,
  ADD COLUMN IF NOT EXISTS user_agent  text,
  ADD COLUMN IF NOT EXISTS ip_hash     text;

-- subscription_events: stripe_invoice_id
ALTER TABLE subscription_events
  ADD COLUMN IF NOT EXISTS stripe_invoice_id text;

-- ai_training_context: created_by / updated_by
ALTER TABLE ai_training_context
  ADD COLUMN IF NOT EXISTS created_by  uuid,
  ADD COLUMN IF NOT EXISTS updated_by  uuid;

-- ── 4. Foreign Keys ───────────────────────────────────────────────────────────

ALTER TABLE users                ADD CONSTRAINT fk_users_tenant          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE subscriptions        ADD CONSTRAINT fk_subs_tenant            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE subscription_events  ADD CONSTRAINT fk_subevt_tenant          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE token_purchases      ADD CONSTRAINT fk_tokpurchase_tenant      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE cancellations        ADD CONSTRAINT fk_cancellations_tenant    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE invitations          ADD CONSTRAINT fk_invitations_tenant      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE invitations          ADD CONSTRAINT fk_invitations_invited_by  FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE events               ADD CONSTRAINT fk_events_tenant           FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE saved_views          ADD CONSTRAINT fk_saved_views_tenant      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE saved_views          ADD CONSTRAINT fk_saved_views_user        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE sandbox_configs      ADD CONSTRAINT fk_sandbox_tenant          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE audit_logs           ADD CONSTRAINT fk_audit_tenant            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE audit_logs           ADD CONSTRAINT fk_audit_user              FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE deletion_requests    ADD CONSTRAINT fk_delreq_tenant           FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE deletion_audit_log   ADD CONSTRAINT fk_delaudit_request        FOREIGN KEY (deletion_request_id) REFERENCES deletion_requests(id) ON DELETE CASCADE;
ALTER TABLE admin_notes          ADD CONSTRAINT fk_adminnotes_tenant        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE sensors              ADD CONSTRAINT fk_sensors_tenant           FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE assets               ADD CONSTRAINT fk_assets_tenant            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE assets               ADD CONSTRAINT fk_assets_sensor            FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE;
ALTER TABLE asset_ports          ADD CONSTRAINT fk_aports_asset             FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;
ALTER TABLE asset_vulns          ADD CONSTRAINT fk_avulns_asset             FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;
ALTER TABLE asset_classification_log ADD CONSTRAINT fk_aclasslog_asset      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;
ALTER TABLE asset_classification_log ADD CONSTRAINT fk_aclasslog_tenant     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE asset_classification_log ADD CONSTRAINT fk_aclasslog_user       FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE attack_surfaces      ADD CONSTRAINT fk_surfaces_tenant          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE scans                ADD CONSTRAINT fk_scans_tenant             FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE scans                ADD CONSTRAINT fk_scans_surface            FOREIGN KEY (attack_surface_id) REFERENCES attack_surfaces(id) ON DELETE CASCADE;
ALTER TABLE scans                ADD CONSTRAINT fk_scans_triggered_by       FOREIGN KEY (triggered_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE findings             ADD CONSTRAINT fk_findings_scan            FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE;
ALTER TABLE findings             ADD CONSTRAINT fk_findings_tenant          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE compliance_mappings  ADD CONSTRAINT fk_complmap_finding         FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE;
ALTER TABLE compliance_reports   ADD CONSTRAINT fk_complrep_tenant          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE compliance_reports   ADD CONSTRAINT fk_complrep_scan            FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE SET NULL;
ALTER TABLE engagements          ADD CONSTRAINT fk_engagements_tenant        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE engagement_phases    ADD CONSTRAINT fk_engphases_engagement      FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE CASCADE;
ALTER TABLE engagement_team      ADD CONSTRAINT fk_engteam_engagement        FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE CASCADE;
ALTER TABLE engagement_team      ADD CONSTRAINT fk_engteam_staff             FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE engagement_findings  ADD CONSTRAINT fk_engfindings_engagement    FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE CASCADE;
ALTER TABLE survey_responses     ADD CONSTRAINT fk_survresp_survey           FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE;
ALTER TABLE survey_responses     ADD CONSTRAINT fk_survresp_tenant           FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE survey_responses     ADD CONSTRAINT fk_survresp_user             FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE survey_dismissals    ADD CONSTRAINT fk_survdis_survey            FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE;
ALTER TABLE survey_dismissals    ADD CONSTRAINT fk_survdis_user              FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 5. Unique Constraints ─────────────────────────────────────────────────────

ALTER TABLE assets              ADD CONSTRAINT assets_tenant_mac_key         UNIQUE (tenant_id, mac);
ALTER TABLE asset_ports         ADD CONSTRAINT asset_ports_unique             UNIQUE (asset_id, port, protocol);
ALTER TABLE asset_vulns         ADD CONSTRAINT asset_vulns_unique             UNIQUE (asset_id, cve_id);
ALTER TABLE survey_dismissals   ADD CONSTRAINT survey_dismissals_unique       UNIQUE (survey_id, user_id);
ALTER TABLE subscription_events ADD CONSTRAINT subscription_events_stripe_key UNIQUE (stripe_event_id);
CREATE UNIQUE INDEX IF NOT EXISTS findings_hash_per_scan ON findings (scan_id, finding_hash);

-- ── 6. Check Constraints ──────────────────────────────────────────────────────

ALTER TABLE sensors ADD CONSTRAINT sensors_status_check CHECK (status IN ('active', 'offline', 'disabled'));
ALTER TABLE assets  ADD CONSTRAINT assets_risk_score_check CHECK (risk_score BETWEEN 0 AND 100);
ALTER TABLE asset_ports ADD CONSTRAINT asset_ports_port_check CHECK (port BETWEEN 1 AND 65535);
ALTER TABLE asset_ports ADD CONSTRAINT asset_ports_protocol_check CHECK (protocol IN ('tcp', 'udp'));
ALTER TABLE asset_vulns ADD CONSTRAINT asset_vulns_severity_check CHECK (severity IN ('critical', 'high', 'medium', 'low'));
ALTER TABLE surveys ADD CONSTRAINT surveys_type_check CHECK (type IN ('nps','csat','pmf','feature_request','exit'));

-- ── 7. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans                ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE attack_surfaces      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_context  ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys              ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_dismissals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensors              ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_ports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_vulns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cve_cache            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_mappings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views          ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_classification_log ENABLE ROW LEVEL SECURITY;

-- ── 8. RLS Policies ───────────────────────────────────────────────────────────

-- users
CREATE POLICY users_select_own ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY users_update_own ON users FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY users_service    ON users FOR ALL    TO service_role  USING (true) WITH CHECK (true);

-- tenants
CREATE POLICY tenants_select_own ON tenants FOR SELECT TO authenticated
  USING (id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY tenants_update_own ON tenants FOR UPDATE TO authenticated
  USING (id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY tenants_service    ON tenants FOR ALL TO service_role USING (true) WITH CHECK (true);

-- scans
CREATE POLICY scans_tenant  ON scans  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY scans_service ON scans  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- findings
CREATE POLICY findings_tenant  ON findings FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY findings_service ON findings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- attack_surfaces
CREATE POLICY surfaces_tenant  ON attack_surfaces FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY surfaces_service ON attack_surfaces FOR ALL TO service_role USING (true) WITH CHECK (true);

-- audit_logs
CREATE POLICY audit_logs_tenant  ON audit_logs FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY audit_logs_service ON audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- events
CREATE POLICY events_tenant_read ON events FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY events_service ON events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- subscription_events
CREATE POLICY sub_events_service ON subscription_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ai_training_context
CREATE POLICY ai_ctx_service ON ai_training_context FOR ALL TO service_role USING (true) WITH CHECK (true);

-- surveys
CREATE POLICY surveys_auth_read    ON surveys FOR SELECT TO authenticated USING (active = true);
CREATE POLICY surveys_service      ON surveys FOR ALL TO service_role USING (true) WITH CHECK (true);

-- survey_responses
CREATE POLICY survresp_insert ON survey_responses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY survresp_read   ON survey_responses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY survresp_service ON survey_responses FOR ALL TO service_role USING (true) WITH CHECK (true);

-- survey_dismissals
CREATE POLICY survdis_insert  ON survey_dismissals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY survdis_read    ON survey_dismissals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY survdis_service ON survey_dismissals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- sensors
CREATE POLICY sensors_select  ON sensors FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY sensors_service ON sensors FOR ALL TO service_role USING (true) WITH CHECK (true);

-- assets
CREATE POLICY assets_select  ON assets FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY assets_update  ON assets FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY assets_service ON assets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- asset_ports
CREATE POLICY aports_select  ON asset_ports FOR SELECT TO authenticated
  USING (asset_id IN (SELECT id FROM assets WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())));
CREATE POLICY aports_service ON asset_ports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- asset_vulns
CREATE POLICY avulns_select  ON asset_vulns FOR SELECT TO authenticated
  USING (asset_id IN (SELECT id FROM assets WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())));
CREATE POLICY avulns_service ON asset_vulns FOR ALL TO service_role USING (true) WITH CHECK (true);

-- cve_cache (read-only for authenticated, service manages writes)
CREATE POLICY cve_service ON cve_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

-- invitations
CREATE POLICY invitations_tenant ON invitations FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY invitations_service ON invitations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- compliance_reports
CREATE POLICY complrep_tenant  ON compliance_reports FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY complrep_service ON compliance_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- compliance_mappings
CREATE POLICY complmap_tenant  ON compliance_mappings FOR SELECT TO authenticated
  USING (finding_id IN (SELECT id FROM findings WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())));
CREATE POLICY complmap_service ON compliance_mappings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- saved_views
CREATE POLICY savedviews_own     ON saved_views FOR ALL TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY savedviews_service ON saved_views FOR ALL TO service_role USING (true) WITH CHECK (true);

-- asset_classification_log
CREATE POLICY aclasslog_tenant  ON asset_classification_log FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY aclasslog_insert  ON asset_classification_log FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY aclasslog_service ON asset_classification_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 9. Functions ──────────────────────────────────────────────────────────────

-- Generic updated_at setter
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Assign account_owner to first user in a tenant
CREATE OR REPLACE FUNCTION fn_assign_first_user_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE tenant_id = NEW.tenant_id) THEN
    NEW.role = 'account_owner';
  END IF;
  RETURN NEW;
END;
$$;

-- Auto-remediation timestamp + days_to_remediate
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

-- Update tenant aggregate stats when scan completes
CREATE OR REPLACE FUNCTION update_tenant_scan_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'complete' AND (OLD.status IS NULL OR OLD.status != 'complete') THEN
    UPDATE tenants SET
      total_scans_all_time    = COALESCE(total_scans_all_time, 0) + 1,
      total_tokens_all_time   = COALESCE(total_tokens_all_time, 0) + COALESCE(NEW.tokens_input, 0) + COALESCE(NEW.tokens_output, 0),
      total_cost_usd_all_time = COALESCE(total_cost_usd_all_time, 0) + COALESCE(NEW.cost_usd, 0),
      last_scan_at            = now(),
      activated_at            = COALESCE(activated_at, now())
    WHERE id = NEW.tenant_id;
    IF NEW.started_at IS NOT NULL THEN
      UPDATE scans SET total_duration_ms = EXTRACT(EPOCH FROM (now() - NEW.started_at))::int * 1000
      WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Track first_target_at on tenants
CREATE OR REPLACE FUNCTION track_first_target()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE tenants SET first_target_at = COALESCE(first_target_at, now())
  WHERE id = NEW.tenant_id AND first_target_at IS NULL;
  RETURN NEW;
END;
$$;

-- Track first_scan_at on tenants
CREATE OR REPLACE FUNCTION track_first_scan()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE tenants SET first_scan_at = COALESCE(first_scan_at, now())
  WHERE id = NEW.tenant_id AND first_scan_at IS NULL;
  RETURN NEW;
END;
$$;

-- Increment scans_this_month when scan inserted
CREATE OR REPLACE FUNCTION sync_tenant_scan_counters()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE tenants SET scans_this_month = COALESCE(scans_this_month, 0) + 1
  WHERE id = NEW.tenant_id;
  RETURN NEW;
END;
$$;

-- Update tokens_used_this_month when scan completes
CREATE OR REPLACE FUNCTION fn_on_scan_complete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'complete' AND (OLD.status IS NULL OR OLD.status != 'complete') THEN
    UPDATE tenants SET
      tokens_used_this_month = COALESCE(tokens_used_this_month, 0) + COALESCE(NEW.tokens_input, 0) + COALESCE(NEW.tokens_output, 0)
    WHERE id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Sync last_login_at on tenants when user logs in
CREATE OR REPLACE FUNCTION sync_tenant_last_login()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.last_login_at IS NOT NULL THEN
    UPDATE tenants SET last_login_at = NEW.last_login_at
    WHERE id = NEW.tenant_id AND (last_login_at IS NULL OR NEW.last_login_at > last_login_at);
  END IF;
  RETURN NEW;
END;
$$;

-- Sync tenant MRR from subscriptions
CREATE OR REPLACE FUNCTION sync_tenant_mrr()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE tenants SET mrr_eur = COALESCE(NEW.mrr_eur, 0)
  WHERE id = NEW.tenant_id;
  RETURN NEW;
END;
$$;

-- Sync staff active_engagement_count
CREATE OR REPLACE FUNCTION sync_staff_active_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_staff_id uuid;
BEGIN
  v_staff_id := COALESCE(NEW.staff_id, OLD.staff_id);
  UPDATE staff SET active_engagement_count = (
    SELECT COUNT(*) FROM engagement_team et
    JOIN engagements e ON et.engagement_id = e.id
    WHERE et.staff_id = v_staff_id
    AND e.phase NOT IN ('completed', 'cancelled')
  )
  WHERE id = v_staff_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Sync staff availability flag
CREATE OR REPLACE FUNCTION sync_staff_availability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE staff SET available = (active_engagement_count < max_concurrent)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Generic increment RPC (used by events track route for login_count)
CREATE OR REPLACE FUNCTION increment(table_name text, column_name text, row_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result integer;
BEGIN
  EXECUTE format('UPDATE %I SET %I = COALESCE(%I, 0) + 1 WHERE id = $1 RETURNING %I',
    table_name, column_name, column_name, column_name)
  USING row_id
  INTO result;
  RETURN result;
END;
$$;

-- Increment tenant usage (called by scanner service)
CREATE OR REPLACE FUNCTION increment_tenant_usage(
  p_tenant_id uuid,
  p_tokens_input integer DEFAULT 0,
  p_tokens_output integer DEFAULT 0,
  p_cost_usd numeric DEFAULT 0
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE tenants SET
    tokens_used_this_month  = COALESCE(tokens_used_this_month, 0) + p_tokens_input + p_tokens_output,
    total_tokens_all_time   = COALESCE(total_tokens_all_time, 0)  + p_tokens_input + p_tokens_output,
    total_cost_usd_all_time = COALESCE(total_cost_usd_all_time, 0) + p_cost_usd
  WHERE id = p_tenant_id;
END;
$$;

-- Upsert asset (called by sensor heartbeat route)
CREATE OR REPLACE FUNCTION upsert_asset(
  p_tenant_id uuid,
  p_sensor_id uuid,
  p_ip        text,
  p_mac       text,
  p_hostname  text,
  p_vendor    text,
  p_os_guess  text,
  p_last_seen timestamptz
) RETURNS TABLE (id uuid, hostname text, os_guess text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_hostname text;
  v_os_guess text;
BEGIN
  INSERT INTO assets (tenant_id, sensor_id, ip, mac, hostname, vendor, os_guess, last_seen, is_active)
  VALUES (p_tenant_id, p_sensor_id, p_ip::inet, p_mac::macaddr, p_hostname, p_vendor, p_os_guess, p_last_seen, true)
  ON CONFLICT (tenant_id, mac) DO UPDATE SET
    ip        = EXCLUDED.ip,
    sensor_id = EXCLUDED.sensor_id,
    last_seen = EXCLUDED.last_seen,
    is_active = true,
    hostname  = COALESCE(assets.hostname, EXCLUDED.hostname),
    vendor    = COALESCE(assets.vendor,   EXCLUDED.vendor),
    os_guess  = COALESCE(assets.os_guess, EXCLUDED.os_guess)
  RETURNING assets.id, assets.hostname, assets.os_guess INTO v_id, v_hostname, v_os_guess;
  RETURN QUERY SELECT v_id, v_hostname, v_os_guess;
END;
$$;

-- updated_at triggers for specific tables
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION update_engagements_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION update_ai_context_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ── 10. Triggers ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS users_assign_role ON users;
CREATE TRIGGER users_assign_role
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION fn_assign_first_user_role();

DROP TRIGGER IF EXISTS findings_remediation_trigger ON findings;
CREATE TRIGGER findings_remediation_trigger
  BEFORE UPDATE ON findings
  FOR EACH ROW EXECUTE FUNCTION set_remediation_timestamp();

DROP TRIGGER IF EXISTS scans_completion_trigger ON scans;
CREATE TRIGGER scans_completion_trigger
  AFTER UPDATE ON scans
  FOR EACH ROW EXECUTE FUNCTION update_tenant_scan_stats();

DROP TRIGGER IF EXISTS scans_token_trigger ON scans;
CREATE TRIGGER scans_token_trigger
  AFTER UPDATE ON scans
  FOR EACH ROW EXECUTE FUNCTION fn_on_scan_complete();

DROP TRIGGER IF EXISTS attack_surfaces_first_target_trigger ON attack_surfaces;
CREATE TRIGGER attack_surfaces_first_target_trigger
  AFTER INSERT ON attack_surfaces
  FOR EACH ROW EXECUTE FUNCTION track_first_target();

DROP TRIGGER IF EXISTS scans_first_scan_trigger ON scans;
CREATE TRIGGER scans_first_scan_trigger
  AFTER INSERT ON scans
  FOR EACH ROW EXECUTE FUNCTION track_first_scan();

DROP TRIGGER IF EXISTS scans_counter_trigger ON scans;
CREATE TRIGGER scans_counter_trigger
  AFTER INSERT ON scans
  FOR EACH ROW EXECUTE FUNCTION sync_tenant_scan_counters();

DROP TRIGGER IF EXISTS users_last_login_trigger ON users;
CREATE TRIGGER users_last_login_trigger
  AFTER UPDATE OF last_login_at ON users
  FOR EACH ROW EXECUTE FUNCTION sync_tenant_last_login();

DROP TRIGGER IF EXISTS subscriptions_mrr_trigger ON subscriptions;
CREATE TRIGGER subscriptions_mrr_trigger
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_tenant_mrr();

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_subscriptions_updated_at();

DROP TRIGGER IF EXISTS engagements_updated_at ON engagements;
CREATE TRIGGER engagements_updated_at
  BEFORE UPDATE ON engagements
  FOR EACH ROW EXECUTE FUNCTION update_engagements_updated_at();

DROP TRIGGER IF EXISTS ai_context_updated_at ON ai_training_context;
CREATE TRIGGER ai_context_updated_at
  BEFORE UPDATE ON ai_training_context
  FOR EACH ROW EXECUTE FUNCTION update_ai_context_updated_at();

DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS staff_engagement_count_trigger ON engagement_team;
CREATE TRIGGER staff_engagement_count_trigger
  AFTER INSERT OR DELETE ON engagement_team
  FOR EACH ROW EXECUTE FUNCTION sync_staff_active_count();

DROP TRIGGER IF EXISTS staff_availability_trigger ON staff;
CREATE TRIGGER staff_availability_trigger
  AFTER UPDATE OF active_engagement_count ON staff
  FOR EACH ROW EXECUTE FUNCTION sync_staff_availability();

-- ── 11. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS sensors_tenant_id_idx         ON sensors(tenant_id);
CREATE INDEX IF NOT EXISTS assets_tenant_id_idx          ON assets(tenant_id);
CREATE INDEX IF NOT EXISTS assets_sensor_id_idx          ON assets(sensor_id);
CREATE INDEX IF NOT EXISTS assets_risk_score_idx         ON assets(risk_score DESC);
CREATE INDEX IF NOT EXISTS assets_sensor_stale_idx       ON assets(sensor_id, is_active, last_seen);
CREATE INDEX IF NOT EXISTS asset_ports_asset_id_idx      ON asset_ports(asset_id);
CREATE INDEX IF NOT EXISTS asset_vulns_asset_id_idx      ON asset_vulns(asset_id);
CREATE INDEX IF NOT EXISTS events_tenant_id_idx          ON events(tenant_id);
CREATE INDEX IF NOT EXISTS events_event_idx              ON events(event);
CREATE INDEX IF NOT EXISTS events_created_at_idx         ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS events_user_id_idx            ON events(user_id);
CREATE INDEX IF NOT EXISTS sub_events_tenant_idx         ON subscription_events(tenant_id);
CREATE INDEX IF NOT EXISTS sub_events_type_idx           ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS sub_events_created_at_idx     ON subscription_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_responses_user_id  ON survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_created_at ON survey_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_time        ON audit_logs(tenant_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant_created ON compliance_reports(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant_framework ON compliance_reports(tenant_id, framework);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant_status ON compliance_reports(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_org    ON compliance_reports(tenant_id, report_type, created_at DESC);

-- ── 12. Admin Views ───────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_funnel AS
WITH funnel AS (
  SELECT
    t.id,
    t.created_at AS registered_at,
    t.first_target_at,
    t.first_scan_at,
    t.activated_at,
    t.plan,
    t.mrr_eur,
    t.last_login_at,
    t.last_scan_at,
    t.churn_risk_score,
    CASE
      WHEN t.activated_at    IS NOT NULL THEN 'activated'
      WHEN t.first_scan_at   IS NOT NULL THEN 'scanned'
      WHEN t.first_target_at IS NOT NULL THEN 'targeted'
      ELSE 'registered'
    END AS funnel_stage,
    EXTRACT(EPOCH FROM (t.first_target_at - t.created_at))/60 AS mins_to_first_target,
    EXTRACT(EPOCH FROM (t.first_scan_at   - t.created_at))/60 AS mins_to_first_scan,
    EXTRACT(EPOCH FROM (t.activated_at    - t.created_at))/60 AS mins_to_activation,
    EXTRACT(EPOCH FROM (now() - t.last_login_at))/86400        AS days_since_login,
    EXTRACT(EPOCH FROM (now() - t.last_scan_at))/86400         AS days_since_scan
  FROM tenants t
)
SELECT * FROM funnel;

CREATE OR REPLACE VIEW admin_mrr AS
SELECT
  plan,
  COUNT(*)              AS tenant_count,
  SUM(mrr_eur)          AS mrr_eur,
  SUM(mrr_eur) * 12     AS arr_eur,
  AVG(mrr_eur)          AS arpu_eur,
  SUM(total_scans_all_time)    AS total_scans,
  SUM(total_tokens_all_time)   AS total_tokens,
  SUM(total_cost_usd_all_time) AS total_ai_cost_usd
FROM tenants
WHERE plan != 'free'
GROUP BY plan;

CREATE OR REPLACE VIEW admin_scan_metrics AS
SELECT
  DATE_TRUNC('day', s.created_at) AS scan_date,
  s.scan_type,
  s.model_used,
  COUNT(*)                        AS scan_count,
  COUNT(*) FILTER (WHERE s.status = 'complete') AS completed,
  COUNT(*) FILTER (WHERE s.status = 'failed')   AS failed,
  ROUND(AVG(s.total_duration_ms)/1000)          AS avg_duration_secs,
  ROUND(AVG(s.tokens_input + s.tokens_output))  AS avg_tokens,
  ROUND(AVG(s.cost_usd)::numeric, 4)            AS avg_cost_usd,
  ROUND(AVG(s.findings_count))                  AS avg_findings,
  ROUND(SUM(s.cost_usd) / NULLIF(SUM(s.findings_count),0)::numeric, 4) AS cost_per_finding_usd
FROM scans s
GROUP BY 1, 2, 3
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW admin_finding_quality AS
SELECT
  DATE_TRUNC('month', f.created_at) AS month,
  f.severity,
  COUNT(*)                          AS total_findings,
  COUNT(*) FILTER (WHERE f.false_positive) AS false_positives,
  ROUND(100.0 * COUNT(*) FILTER (WHERE f.false_positive) / NULLIF(COUNT(*), 0)) AS false_positive_pct,
  COUNT(*) FILTER (WHERE f.status = 'remediated') AS remediated,
  ROUND(AVG(f.days_to_remediate))   AS avg_days_to_remediate,
  ROUND(AVG(f.ai_confidence))       AS avg_ai_confidence
FROM findings f
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- ── 13. Realtime Publications ─────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE scans;
ALTER PUBLICATION supabase_realtime ADD TABLE assets;
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- ── 14. Survey Seed Data ──────────────────────────────────────────────────────

INSERT INTO surveys (name, type, trigger_event, trigger_count, trigger_days_after_signup, cooldown_days, questions) VALUES
('Net Promoter Score', 'nps', 'scan.completed', 5, null, 90,
'[{"id":"q1","type":"rating_10","text":"How likely are you to recommend Breachr to a compliance peer or colleague?"},{"id":"q2","type":"open_text","text":"What is the main reason for your score?","optional":true}]'::jsonb),

('Product Satisfaction', 'csat', null, null, 3, 60,
'[{"id":"q1","type":"rating_5","text":"How satisfied are you with Breachr overall?"},{"id":"q2","type":"rating_5","text":"How easy is it to understand and act on your scan results?"},{"id":"q3","type":"open_text","text":"What could we improve?","optional":true}]'::jsonb),

('Product-Market Fit', 'pmf', null, null, 14, 120,
'[{"id":"q1","type":"choice","text":"How would you feel if you could no longer use Breachr?","options":["Very disappointed","Somewhat disappointed","Not disappointed"]}]'::jsonb),

('Feature Wishlist', 'feature_request', null, null, 30, 90,
'[{"id":"q1","type":"open_text","text":"What one feature or improvement would make the biggest difference for your compliance workflow?"},{"id":"q2","type":"choice","text":"Which area matters most to you right now?","options":["Scan coverage & speed","Report quality","DORA / NIS2 compliance depth","Integrations & APIs","Pricing & value","Other"]}]'::jsonb),

('Exit Survey', 'exit', 'billing.plan_cancelled', 1, null, 0,
'[{"id":"q1","type":"choice","text":"What is the main reason you are cancelling?","options":["Too expensive","Missing features I need","Switching to a competitor","No longer need pentesting","Technical issues","Other"]},{"id":"q2","type":"open_text","text":"Is there anything we could have done differently?","optional":true}]'::jsonb);
