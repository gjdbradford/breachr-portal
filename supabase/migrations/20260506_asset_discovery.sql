-- portal/supabase/migrations/20260506_asset_discovery.sql

CREATE TABLE sensors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  token_hash  text NOT NULL,
  location    text,
  last_seen   timestamptz,
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'offline', 'disabled')),
  config      jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX sensors_tenant_id_idx ON sensors(tenant_id);

CREATE TABLE assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sensor_id   uuid NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  ip          inet NOT NULL,
  mac         macaddr NOT NULL,
  hostname    text,
  vendor      text,
  os_guess    text,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  is_active   bool NOT NULL DEFAULT true,
  risk_score  int NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  UNIQUE (tenant_id, mac)
);

CREATE INDEX assets_tenant_id_idx ON assets(tenant_id);
CREATE INDEX assets_sensor_id_idx ON assets(sensor_id);
CREATE INDEX assets_risk_score_idx ON assets(risk_score DESC);
CREATE INDEX assets_sensor_stale_idx ON assets(sensor_id, is_active, last_seen);

CREATE TABLE asset_ports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  port       int NOT NULL CHECK (port BETWEEN 1 AND 65535),
  protocol   text NOT NULL CHECK (protocol IN ('tcp', 'udp')),
  service    text,
  banner     text,
  last_seen  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, port, protocol)
);

CREATE INDEX asset_ports_asset_id_idx ON asset_ports(asset_id);

CREATE TABLE asset_vulns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  cve_id        text NOT NULL,
  severity      text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  cvss_score    numeric(4,1),
  title         text,
  last_checked  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, cve_id)
);

CREATE INDEX asset_vulns_asset_id_idx ON asset_vulns(asset_id);

CREATE TABLE cve_cache (
  cve_id      text PRIMARY KEY,
  data        jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: portal reads only (writes go through service role key in API routes)
ALTER TABLE sensors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_ports ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_vulns ENABLE ROW LEVEL SECURITY;
ALTER TABLE cve_cache   ENABLE ROW LEVEL SECURITY;
-- No direct client access needed — all reads go through server components with service role

CREATE POLICY sensors_select ON sensors FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY assets_select ON assets FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY asset_ports_select ON asset_ports FOR SELECT
  USING (asset_id IN (
    SELECT id FROM assets
    WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY asset_vulns_select ON asset_vulns FOR SELECT
  USING (asset_id IN (
    SELECT id FROM assets
    WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  ));
