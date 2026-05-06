# Asset Discovery & Inventory Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Docker-based network sensor that discovers internal assets and surfaces a risk-scored inventory inside the Breachr portal, satisfying DORA Art. 8, NIS2 Art. 21, and PCI-DSS Req 12.5.

**Architecture:** Docker sensors deployed in customer networks phone home via HTTPS to new Next.js API routes. API routes write to Supabase using the service role key. A nightly Vercel cron fetches NVD CVE data and correlates it against discovered assets to produce risk scores.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres, bcryptjs (token hashing), Zod (payload validation), Python 3.12 + scapy + python-nmap + httpx + schedule (sensor), pytest (sensor tests), NVD 2.0 API (CVE enrichment)

---

## File Structure

**Portal (new files):**
- `portal/supabase/migrations/20260506_asset_discovery.sql` — 5 new tables + RLS
- `portal/app/api/sensors/route.ts` — POST: register sensor, return one-time token
- `portal/app/api/sensors/[id]/heartbeat/route.ts` — POST: ingest asset batch from sensor
- `portal/app/api/crons/cve-enrichment/route.ts` — GET: nightly NVD fetch + enrichment
- `portal/app/dashboard/inventory/page.tsx` — asset list server component
- `portal/app/dashboard/inventory/[assetId]/page.tsx` — asset detail server component
- `portal/app/dashboard/sensors/page.tsx` — sensor management server component
- `portal/components/SensorRegistrationModal.tsx` — 'use client' modal for add-sensor flow

**Portal (modified files):**
- `portal/components/DashboardNav.tsx` — add Inventory + Sensors nav links
- `portal/vercel.json` — add cron schedule for CVE enrichment

**Sensor (new directory `sensor/` at repo root):**
- `sensor/models.py` — Asset dataclass
- `sensor/listener.py` — passive ARP / mDNS / DHCP sniffer
- `sensor/heartbeat.py` — HTTP client with retry/backoff
- `sensor/scanner.py` — nmap active scan
- `sensor/main.py` — thread management + entry point
- `sensor/requirements.txt`
- `sensor/Dockerfile`
- `sensor/tests/test_models.py`
- `sensor/tests/test_listener.py`
- `sensor/tests/test_heartbeat.py`
- `sensor/tests/test_scanner.py`

---

## Task 1: Database Migration

**Files:**
- Create: `portal/supabase/migrations/20260506_asset_discovery.sql`

- [ ] **Step 1: Write the migration file**

```sql
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
ALTER TABLE sensors    ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_ports ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_vulns ENABLE ROW LEVEL SECURITY;

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
```

- [ ] **Step 2: Run the migration in Supabase SQL editor**

Open Supabase dashboard → SQL Editor → paste the file content above → Run.

Expected: "Success. No rows returned."

- [ ] **Step 3: Verify tables exist**

In Supabase SQL Editor:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('sensors', 'assets', 'asset_ports', 'asset_vulns', 'cve_cache');
```

Expected: 5 rows returned.

- [ ] **Step 4: Commit**

```bash
git add portal/supabase/migrations/20260506_asset_discovery.sql
git commit -m "feat: add asset discovery DB migration"
```

---

## Task 2: Sensor Registration API

**Files:**
- Create: `portal/app/api/sensors/route.ts`

This route lets a portal user register a new sensor. It generates a random token, stores its bcrypt hash, and returns the plaintext token **once**.

- [ ] **Step 1: Install bcryptjs**

```bash
cd portal && npm install bcryptjs && npm install --save-dev @types/bcryptjs
```

Expected: `added N packages`

- [ ] **Step 2: Write the route**

```typescript
// portal/app/api/sensors/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const name: string = (body.name ?? '').trim()
  const location: string = (body.location ?? '').trim()

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const token = randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(token, 10)

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: sensor, error } = await admin
    .from('sensors')
    .insert({
      tenant_id:  profile.tenant_id,
      name,
      location:   location || null,
      token_hash: tokenHash,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: sensor.id, token })
}
```

- [ ] **Step 3: Smoke-test via curl**

First, get a session cookie by logging into the portal, then:

```bash
curl -X POST http://localhost:3000/api/sensors \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste session cookie>" \
  -d '{"name": "Test Sensor", "location": "Dev machine"}'
```

Expected response:

```json
{ "id": "<uuid>", "token": "<64-char hex string>" }
```

Verify the row exists in Supabase:

```sql
SELECT id, name, location, length(token_hash) AS hash_len FROM sensors LIMIT 5;
```

Expected: one row, `hash_len` = 60 (bcrypt format).

- [ ] **Step 4: Test missing name returns 400**

```bash
curl -X POST http://localhost:3000/api/sensors \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste session cookie>" \
  -d '{}'
```

Expected: `{ "error": "name is required" }` with status 400.

- [ ] **Step 5: Commit**

```bash
git add portal/app/api/sensors/route.ts portal/package.json portal/package-lock.json
git commit -m "feat: add sensor registration API"
```

---

## Task 3: Heartbeat API

**Files:**
- Create: `portal/app/api/sensors/[id]/heartbeat/route.ts`

This route receives a batch of discovered assets from the sensor, validates the token, upserts assets and ports, then marks stale assets inactive.

- [ ] **Step 1: Write the Zod schema**

```typescript
// portal/app/api/sensors/[id]/heartbeat/route.ts
import { NextResponse } from 'next/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const PortSchema = z.object({
  port:     z.number().int().min(1).max(65535),
  protocol: z.enum(['tcp', 'udp']),
  service:  z.string().optional(),
  banner:   z.string().optional(),
})

const AssetSchema = z.object({
  ip:       z.string().ip(),
  mac:      z.string().regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i),
  hostname: z.string().optional(),
  vendor:   z.string().optional(),
  os_guess: z.string().optional(),
  ports:    z.array(PortSchema).default([]),
})

const HeartbeatSchema = z.object({
  assets: z.array(AssetSchema).min(0).max(500),
})
```

- [ ] **Step 2: Write the route handler**

Add below the schema:

```typescript
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sensorId } = await params

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Validate sensor token
  const { data: sensor } = await admin
    .from('sensors')
    .select('id, tenant_id, token_hash, status')
    .eq('id', sensorId)
    .single()

  if (!sensor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (sensor.status === 'disabled') return NextResponse.json({ error: 'Sensor disabled' }, { status: 403 })

  const valid = await bcrypt.compare(token, sensor.token_hash)
  if (!valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = HeartbeatSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const { assets } = parsed.data
  const now = new Date().toISOString()
  let upserted = 0

  for (const asset of assets) {
    // Upsert asset — on conflict (tenant_id, mac) update ip/last_seen/is_active only
    // hostname and os_guess are only set if null (don't overwrite manual edits)
    const { data: upsertedAsset } = await admin
      .from('assets')
      .upsert(
        {
          tenant_id:  sensor.tenant_id,
          sensor_id:  sensorId,
          ip:         asset.ip,
          mac:        asset.mac,
          hostname:   asset.hostname ?? null,
          vendor:     asset.vendor ?? null,
          os_guess:   asset.os_guess ?? null,
          last_seen:  now,
          is_active:  true,
        },
        {
          onConflict:        'tenant_id,mac',
          ignoreDuplicates:  false,
        }
      )
      .select('id, hostname, os_guess')
      .single()

    if (!upsertedAsset) continue

    // If hostname/os_guess already set, don't overwrite with null from sensor
    if (upsertedAsset.hostname && !asset.hostname) {
      // Already has hostname — skip update (handled by not providing null above, but
      // the upsert overwrites — fix: do a conditional update instead)
    }

    upserted++

    // Upsert ports
    if (asset.ports.length > 0) {
      await admin.from('asset_ports').upsert(
        asset.ports.map(p => ({
          asset_id:  upsertedAsset.id,
          port:      p.port,
          protocol:  p.protocol,
          service:   p.service ?? null,
          banner:    p.banner ?? null,
          last_seen: now,
        })),
        { onConflict: 'asset_id,port,protocol', ignoreDuplicates: false }
      )
    }
  }

  // Mark assets not seen in 24h as inactive
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await admin
    .from('assets')
    .update({ is_active: false })
    .eq('sensor_id', sensorId)
    .lt('last_seen', cutoff)
    .eq('is_active', true)

  // Update sensor last_seen
  await admin.from('sensors').update({ last_seen: now }).eq('id', sensorId)

  return NextResponse.json({ upserted })
}
```

- [ ] **Step 3: Fix the hostname/os_guess overwrite issue**

The upsert above would overwrite `hostname` with null when the sensor doesn't know it but the DB already has a value. Use a raw SQL upsert with `COALESCE` instead:

Replace the asset upsert block with:

```typescript
    const { data: upsertedAsset } = await admin.rpc('upsert_asset', {
      p_tenant_id: sensor.tenant_id,
      p_sensor_id: sensorId,
      p_ip:        asset.ip,
      p_mac:       asset.mac,
      p_hostname:  asset.hostname ?? null,
      p_vendor:    asset.vendor ?? null,
      p_os_guess:  asset.os_guess ?? null,
      p_last_seen: now,
    })
```

And add this SQL function to the migration (add to a new migration file):

- [ ] **Step 4: Create the upsert_asset SQL function**

Create file `portal/supabase/migrations/20260506_asset_discovery_fn.sql`:

```sql
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
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
  v_hostname text;
  v_os_guess text;
BEGIN
  INSERT INTO assets (tenant_id, sensor_id, ip, mac, hostname, vendor, os_guess, last_seen, is_active)
  VALUES (p_tenant_id, p_sensor_id, p_ip::inet, p_mac::macaddr, p_hostname, p_vendor, p_os_guess, p_last_seen, true)
  ON CONFLICT (tenant_id, mac) DO UPDATE SET
    ip        = EXCLUDED.ip,
    last_seen = EXCLUDED.last_seen,
    is_active = true,
    hostname  = COALESCE(assets.hostname, EXCLUDED.hostname),
    vendor    = COALESCE(assets.vendor,   EXCLUDED.vendor),
    os_guess  = COALESCE(assets.os_guess, EXCLUDED.os_guess)
  RETURNING assets.id, assets.hostname, assets.os_guess INTO v_id, v_hostname, v_os_guess;

  RETURN QUERY SELECT v_id, v_hostname, v_os_guess;
END;
$$;
```

Run this in Supabase SQL Editor.

- [ ] **Step 5: Smoke-test the heartbeat**

Using the sensor ID and token from Task 2:

```bash
curl -X POST http://localhost:3000/api/sensors/<sensor-id>/heartbeat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "assets": [
      {
        "ip": "192.168.1.42",
        "mac": "aa:bb:cc:dd:ee:ff",
        "hostname": "test-device.local",
        "vendor": "Apple Inc.",
        "os_guess": "macOS",
        "ports": [
          { "port": 22, "protocol": "tcp", "service": "ssh", "banner": "OpenSSH_9.0" }
        ]
      }
    ]
  }'
```

Expected: `{ "upserted": 1 }`

Verify in Supabase:
```sql
SELECT ip, mac, hostname, is_active FROM assets;
SELECT port, protocol, service, banner FROM asset_ports;
```

- [ ] **Step 6: Test bad token returns 401**

```bash
curl -X POST http://localhost:3000/api/sensors/<sensor-id>/heartbeat \
  -H "Authorization: Bearer wrongtoken" \
  -H "Content-Type: application/json" \
  -d '{"assets": []}'
```

Expected: `{ "error": "Unauthorized" }` status 401.

- [ ] **Step 7: Test invalid payload returns 400**

```bash
curl -X POST http://localhost:3000/api/sensors/<sensor-id>/heartbeat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"assets": [{"ip": "not-an-ip", "mac": "bad"}]}'
```

Expected: `{ "error": "Invalid payload", "details": {...} }` status 400.

- [ ] **Step 8: Commit**

```bash
git add portal/app/api/sensors/[id]/heartbeat/route.ts \
        portal/supabase/migrations/20260506_asset_discovery_fn.sql
git commit -m "feat: add sensor heartbeat ingest API"
```

---

## Task 4: CVE Enrichment Cron

**Files:**
- Create: `portal/app/api/crons/cve-enrichment/route.ts`
- Modify: `portal/vercel.json`

The NVD 2.0 API endpoint is `https://services.nvd.nist.gov/rest/json/cves/2.0`. It returns paginated CVE data. We fetch CVEs modified in the last 24h, cache them, and correlate against discovered assets.

- [ ] **Step 1: Add cron to vercel.json**

Current `portal/vercel.json`:
```json
{
  "alias": ["breachr-portal.vercel.app"]
}
```

Replace with:
```json
{
  "alias": ["breachr-portal.vercel.app"],
  "crons": [
    {
      "path": "/api/crons/cve-enrichment",
      "schedule": "0 2 * * *"
    }
  ]
}
```

- [ ] **Step 2: Write the cron route**

```typescript
// portal/app/api/crons/cve-enrichment/route.ts
import { NextResponse } from 'next/server'
import { createClient as adminClient } from '@supabase/supabase-js'

const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0'
const PAGE_SIZE = 2000
const RATE_DELAY_MS = 600

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function scoreSeverity(cvssScore: number): 'critical' | 'high' | 'medium' | 'low' {
  if (cvssScore >= 9.0) return 'critical'
  if (cvssScore >= 7.0) return 'high'
  if (cvssScore >= 4.0) return 'medium'
  return 'low'
}

function riskPoints(severity: string): number {
  if (severity === 'critical') return 40
  if (severity === 'high')     return 20
  if (severity === 'medium')   return 10
  return 0
}

export async function GET(req: Request) {
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
  if (req.headers.get('authorization') !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Fetch CVEs modified in last 24h from NVD
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const pubStartDate = since.toISOString().replace('.000Z', '.000')

  let startIndex = 0
  let totalResults = Infinity
  const allCves: Array<{ cve_id: string; data: object; severity: string; cvss: number; title: string }> = []

  try {
    while (startIndex < totalResults) {
      const url = `${NVD_BASE}?lastModStartDate=${pubStartDate}&startIndex=${startIndex}&resultsPerPage=${PAGE_SIZE}`
      const resp = await fetch(url, { headers: { 'User-Agent': 'Breachr/1.0' } })
      if (!resp.ok) {
        console.error(`NVD fetch failed: ${resp.status}`)
        break
      }
      const json: any = await resp.json()
      totalResults = json.totalResults ?? 0

      for (const vuln of json.vulnerabilities ?? []) {
        const cve = vuln.cve
        const cveId: string = cve.id
        const metrics = cve.metrics?.cvssMetricV31?.[0] ?? cve.metrics?.cvssMetricV2?.[0]
        const cvssScore: number = metrics?.cvssData?.baseScore ?? 0
        const severity = scoreSeverity(cvssScore)
        const title: string = cve.descriptions?.find((d: any) => d.lang === 'en')?.value?.slice(0, 200) ?? ''

        allCves.push({ cve_id: cveId, data: cve, severity, cvss: cvssScore, title })
      }

      startIndex += PAGE_SIZE
      if (startIndex < totalResults) await sleep(RATE_DELAY_MS)
    }
  } catch (err) {
    console.error('NVD fetch error — skipping enrichment cycle', err)
    return NextResponse.json({ ok: false, error: 'NVD unreachable' })
  }

  // Upsert into cve_cache
  if (allCves.length > 0) {
    await admin.from('cve_cache').upsert(
      allCves.map(c => ({ cve_id: c.cve_id, data: c.data, fetched_at: new Date().toISOString() })),
      { onConflict: 'cve_id' }
    )
  }

  // Match assets with os_guess or ports to CVEs
  const { data: assets } = await admin
    .from('assets')
    .select('id, os_guess')
    .not('os_guess', 'is', null)

  const { data: ports } = await admin
    .from('asset_ports')
    .select('id, asset_id, service, banner')

  const vulnUpserts: Array<{
    asset_id: string; cve_id: string; severity: string; cvss_score: number; title: string; last_checked: string
  }> = []

  const now = new Date().toISOString()

  for (const cve of allCves) {
    const cveText = JSON.stringify(cve.data).toLowerCase()

    // Match by os_guess keyword in CVE text
    for (const asset of assets ?? []) {
      const osKey = (asset.os_guess ?? '').toLowerCase().split(' ')[0]
      if (osKey && cveText.includes(osKey)) {
        vulnUpserts.push({
          asset_id:     asset.id,
          cve_id:       cve.cve_id,
          severity:     cve.severity,
          cvss_score:   cve.cvss,
          title:        cve.title,
          last_checked: now,
        })
      }
    }

    // Match by service/banner keyword in CVE text
    for (const port of ports ?? []) {
      const svc = (port.service ?? '').toLowerCase()
      const banner = (port.banner ?? '').toLowerCase()
      if ((svc && cveText.includes(svc)) || (banner && cveText.includes(banner.split('/')[0]))) {
        vulnUpserts.push({
          asset_id:     port.asset_id,
          cve_id:       cve.cve_id,
          severity:     cve.severity,
          cvss_score:   cve.cvss,
          title:        cve.title,
          last_checked: now,
        })
      }
    }
  }

  // Deduplicate by asset_id + cve_id before upsert
  const dedupedVulns = [...new Map(
    vulnUpserts.map(v => [`${v.asset_id}:${v.cve_id}`, v])
  ).values()]

  if (dedupedVulns.length > 0) {
    await admin.from('asset_vulns').upsert(dedupedVulns, { onConflict: 'asset_id,cve_id' })
  }

  // Recalculate risk_score for affected assets
  const affectedAssetIds = [...new Set(dedupedVulns.map(v => v.asset_id))]

  for (const assetId of affectedAssetIds) {
    const { data: vulns } = await admin
      .from('asset_vulns')
      .select('severity')
      .eq('asset_id', assetId)

    const score = Math.min(100, (vulns ?? []).reduce((sum, v) => sum + riskPoints(v.severity), 0))

    await admin.from('assets').update({ risk_score: score }).eq('id', assetId)
  }

  return NextResponse.json({
    ok: true,
    cves_fetched: allCves.length,
    vulns_matched: dedupedVulns.length,
    assets_updated: affectedAssetIds.length,
  })
}
```

- [ ] **Step 3: Add CRON_SECRET to .env.local**

Add to `portal/.env.local`:

```
CRON_SECRET=dev-cron-secret-change-in-production
```

Add the same key to Vercel environment variables via the dashboard: Settings → Environment Variables → `CRON_SECRET` → set a long random value for production.

- [ ] **Step 4: Smoke-test the cron locally**

```bash
curl http://localhost:3000/api/crons/cve-enrichment \
  -H "Authorization: Bearer dev-cron-secret-change-in-production"
```

Expected (if NVD reachable):
```json
{ "ok": true, "cves_fetched": N, "vulns_matched": N, "assets_updated": N }
```

Expected (no matching assets yet — that's fine):
```json
{ "ok": true, "cves_fetched": N, "vulns_matched": 0, "assets_updated": 0 }
```

- [ ] **Step 5: Test bad auth returns 401**

```bash
curl http://localhost:3000/api/crons/cve-enrichment \
  -H "Authorization: Bearer wrong"
```

Expected: `{ "error": "Unauthorized" }` status 401.

- [ ] **Step 6: Commit**

```bash
git add portal/app/api/crons/cve-enrichment/route.ts portal/vercel.json portal/.env.local
git commit -m "feat: add nightly CVE enrichment cron"
```

---

## Task 5: Add Inventory & Sensors to Navigation

**Files:**
- Modify: `portal/components/DashboardNav.tsx`

- [ ] **Step 1: Read the current nav links array**

In `portal/components/DashboardNav.tsx`, the links array (lines 10–18) currently is:

```typescript
const links = [
  { href: '/dashboard',          label: 'Overview',    icon: '◈' },
  { href: '/dashboard/targets',  label: 'Targets',     icon: '◎' },
  { href: '/dashboard/scans',    label: 'Scans',       icon: '⟳' },
  { href: '/dashboard/findings', label: 'Findings',    icon: '⚠' },
  { href: '/dashboard/reports',  label: 'Reports',     icon: '▤' },
  { href: '/dashboard/audit',    label: 'Audit Trail', icon: '⛓' },
  { href: '/dashboard/settings', label: 'Settings',    icon: '⚙' },
]
```

- [ ] **Step 2: Add Inventory and Sensors links**

Replace the links array with:

```typescript
const links = [
  { href: '/dashboard',             label: 'Overview',    icon: '◈' },
  { href: '/dashboard/targets',     label: 'Targets',     icon: '◎' },
  { href: '/dashboard/scans',       label: 'Scans',       icon: '⟳' },
  { href: '/dashboard/findings',    label: 'Findings',    icon: '⚠' },
  { href: '/dashboard/reports',     label: 'Reports',     icon: '▤' },
  { href: '/dashboard/inventory',   label: 'Inventory',   icon: '⬡' },
  { href: '/dashboard/sensors',     label: 'Sensors',     icon: '◉' },
  { href: '/dashboard/audit',       label: 'Audit Trail', icon: '⛓' },
  { href: '/dashboard/settings',    label: 'Settings',    icon: '⚙' },
]
```

- [ ] **Step 3: Verify nav renders**

Run `npm run dev` in `portal/`, open http://localhost:3000/dashboard. Confirm "Inventory" and "Sensors" appear in the sidebar. Both links will 404 until the pages are built — that's expected.

- [ ] **Step 4: Commit**

```bash
git add portal/components/DashboardNav.tsx
git commit -m "feat: add Inventory and Sensors nav links"
```

---

## Task 6: Inventory List Page

**Files:**
- Create: `portal/app/dashboard/inventory/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
// portal/app/dashboard/inventory/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function RiskBar({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return null
  const colors: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e',
  }
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {(['critical', 'high', 'medium', 'low'] as const).map(s => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[s] }} />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            <span style={{ color: colors[s], fontWeight: 700 }}>{counts[s] ?? 0}</span> {s}
          </span>
        </div>
      ))}
    </div>
  )
}

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: assets } = await supabase
    .from('assets')
    .select('id, ip, mac, hostname, vendor, os_guess, last_seen, is_active, risk_score')
    .eq('tenant_id', profile.tenant_id)
    .order('risk_score', { ascending: false })

  // Count open ports per asset
  const assetIds = (assets ?? []).map(a => a.id)
  const { data: portCounts } = assetIds.length > 0
    ? await supabase
        .from('asset_ports')
        .select('asset_id')
        .in('asset_id', assetIds)
    : { data: [] }

  const portCountMap: Record<string, number> = {}
  for (const p of portCounts ?? []) {
    portCountMap[p.asset_id] = (portCountMap[p.asset_id] ?? 0) + 1
  }

  // Risk severity counts
  const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const a of assets ?? []) {
    const score = a.risk_score ?? 0
    if (score >= 80)      riskCounts.critical++
    else if (score >= 50) riskCounts.high++
    else if (score >= 20) riskCounts.medium++
    else if (score > 0)   riskCounts.low++
  }

  const activeCount = (assets ?? []).filter(a => a.is_active).length

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>INVENTORY</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {activeCount} active assets · {(assets ?? []).length} total
          </p>
        </div>
      </div>

      {/* Risk overview */}
      {(assets ?? []).length > 0 && (
        <div style={{ padding: '0 24px 16px' }}>
          <RiskBar counts={riskCounts} />
        </div>
      )}

      {/* Table */}
      <div className="gs au1" style={{ padding: 24 }}>
        {(assets ?? []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>No assets discovered yet</p>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              Deploy a sensor in your network to start discovering assets.{' '}
              <Link href="/dashboard/sensors" style={{ color: '#42a5f5' }}>Add a sensor →</Link>
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>IP</th>
                <th>Hostname</th>
                <th>Vendor / OS</th>
                <th>Ports</th>
                <th>Risk</th>
                <th>Last seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(assets ?? []).map(a => {
                const score = a.risk_score ?? 0
                const riskColor = score >= 80 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 20 ? '#f59e0b' : '#22c55e'
                return (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 13, color: '#e2e8f0' }}>{a.ip}</td>
                    <td style={{ fontSize: 12, color: '#94a3b8' }}>{a.hostname ?? '—'}</td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>
                      {[a.vendor, a.os_guess].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{portCountMap[a.id] ?? 0}</td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 700, color: riskColor }}>
                        {score > 0 ? score : '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>
                      {new Date(a.last_seen).toLocaleDateString('en-GB')}
                      {!a.is_active && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: '#475569',
                          background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3 }}>
                          offline
                        </span>
                      )}
                    </td>
                    <td>
                      <Link href={`/dashboard/inventory/${a.id}`} className="btn-s"
                        style={{ fontSize: 12, padding: '4px 12px' }}>
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify page loads**

Open http://localhost:3000/dashboard/inventory. With a test heartbeat already sent (from Task 3), the asset row should appear. Without any assets, the empty state with "Add a sensor →" link should show.

- [ ] **Step 3: Commit**

```bash
git add portal/app/dashboard/inventory/page.tsx
git commit -m "feat: add inventory list page"
```

---

## Task 7: Asset Detail Page

**Files:**
- Create: `portal/app/dashboard/inventory/[assetId]/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
// portal/app/dashboard/inventory/[assetId]/page.tsx
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e',
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>
}) {
  const { assetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const [
    { data: asset },
    { data: ports },
    { data: vulns },
  ] = await Promise.all([
    supabase
      .from('assets')
      .select('id, ip, mac, hostname, vendor, os_guess, first_seen, last_seen, is_active, risk_score, sensor_id')
      .eq('id', assetId)
      .eq('tenant_id', profile.tenant_id)
      .single(),
    supabase
      .from('asset_ports')
      .select('port, protocol, service, banner, last_seen')
      .eq('asset_id', assetId)
      .order('port', { ascending: true }),
    supabase
      .from('asset_vulns')
      .select('cve_id, severity, cvss_score, title, last_checked')
      .eq('asset_id', assetId)
      .order('cvss_score', { ascending: false }),
  ])

  if (!asset) notFound()

  // Get sensor location
  const { data: sensor } = await supabase
    .from('sensors')
    .select('name, location')
    .eq('id', asset.sensor_id)
    .single()

  const score = asset.risk_score ?? 0
  const riskColor = score >= 80 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 20 ? '#f59e0b' : '#64748b'

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <div style={{ marginBottom: 4 }}>
            <Link href="/dashboard/inventory" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none' }}>
              ← Inventory
            </Link>
          </div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>
            {asset.hostname ?? asset.ip}
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {asset.ip} · {asset.mac}
            {sensor?.location && ` · ${sensor.location}`}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: riskColor }}>{score > 0 ? score : '—'}</div>
          <div style={{ fontSize: 11, color: '#475569' }}>risk score</div>
        </div>
      </div>

      {/* Asset metadata */}
      <div className="gs au1" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: 16 }}>ASSET DETAILS</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            ['Vendor',     asset.vendor    ?? '—'],
            ['OS',         asset.os_guess  ?? '—'],
            ['Status',     asset.is_active ? 'Active' : 'Offline'],
            ['First seen', new Date(asset.first_seen).toLocaleDateString('en-GB')],
            ['Last seen',  new Date(asset.last_seen).toLocaleDateString('en-GB')],
            ['Sensor',     sensor?.name ?? '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, color: '#e2e8f0' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Open ports */}
      <div className="gs au1" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: 16 }}>
          OPEN PORTS ({(ports ?? []).length})
        </h2>
        {(ports ?? []).length === 0 ? (
          <p style={{ fontSize: 13, color: '#475569' }}>No ports discovered — run an active scan to discover open ports.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Port</th><th>Protocol</th><th>Service</th><th>Banner</th><th>Last seen</th></tr>
            </thead>
            <tbody>
              {(ports ?? []).map(p => (
                <tr key={`${p.port}-${p.protocol}`}>
                  <td style={{ fontFamily: 'monospace', color: '#e2e8f0', fontSize: 13 }}>{p.port}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{p.protocol}</td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{p.service ?? '—'}</td>
                  <td style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>{p.banner ?? '—'}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(p.last_seen).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CVE findings */}
      <div className="gs au1" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: 16 }}>
          CVE FINDINGS ({(vulns ?? []).length})
        </h2>
        {(vulns ?? []).length === 0 ? (
          <p style={{ fontSize: 13, color: '#475569' }}>No CVE matches found for this asset.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>CVE</th><th>Severity</th><th>CVSS</th><th>Description</th></tr>
            </thead>
            <tbody>
              {(vulns ?? []).map(v => (
                <tr key={v.cve_id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{v.cve_id}</td>
                  <td>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                      background: `${SEVERITY_COLORS[v.severity] ?? '#64748b'}22`,
                      color: SEVERITY_COLORS[v.severity] ?? '#64748b',
                      border: `1px solid ${SEVERITY_COLORS[v.severity] ?? '#64748b'}44`,
                    }}>
                      {v.severity}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{v.cvss_score ?? '—'}</td>
                  <td style={{ fontSize: 12, color: '#64748b', maxWidth: 400 }}>{v.title ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify page loads**

Send a heartbeat (Task 3 curl command), then navigate to `/dashboard/inventory`, click "View" on the test asset. Confirm all sections render.

- [ ] **Step 3: Commit**

```bash
git add portal/app/dashboard/inventory/[assetId]/page.tsx
git commit -m "feat: add asset detail page"
```

---

## Task 8: Sensors Management Page

**Files:**
- Create: `portal/app/dashboard/sensors/page.tsx`
- Create: `portal/components/SensorRegistrationModal.tsx`

- [ ] **Step 1: Write the SensorRegistrationModal client component**

```typescript
// portal/components/SensorRegistrationModal.tsx
'use client'

import { useState } from 'react'

interface Props {
  onClose: () => void
}

export default function SensorRegistrationModal({ onClose }: Props) {
  const [name, setName]         = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [result, setResult]     = useState<{ id: string; token: string } | null>(null)
  const [copied, setCopied]     = useState(false)

  const apiUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function handleRegister() {
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/sensors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), location: location.trim() }),
    })
    setLoading(false)
    if (!res.ok) { setError((await res.json()).error ?? 'Failed'); return }
    setResult(await res.json())
  }

  const dockerCmd = result
    ? `docker run -d --network host \\\n  -e BREACHR_SENSOR_TOKEN=${result.token} \\\n  -e BREACHR_SENSOR_ID=${result.id} \\\n  -e BREACHR_API_URL=${apiUrl} \\\n  ghcr.io/breachr/sensor:latest`
    : ''

  async function copyCmd() {
    await navigator.clipboard.writeText(dockerCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0f1629', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
        padding: 32, width: 520, maxWidth: '90vw',
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>Add Sensor</h2>

        {!result ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Office London"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 13,
                }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Location (optional)</label>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="2nd floor server room"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 13,
                }}
              />
            </div>
            {error && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 16 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleRegister} disabled={loading} className="btn-p"
                style={{ fontSize: 13, padding: '8px 20px' }}>
                {loading ? 'Registering…' : 'Register sensor'}
              </button>
              <button onClick={onClose} style={{ fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: '#22c55e', marginBottom: 16 }}>
              Sensor registered. Copy the command below and run it on a machine inside your network.
              <strong style={{ color: '#ef4444' }}> The token will not be shown again.</strong>
            </p>
            <div style={{
              background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 16, marginBottom: 16,
              fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', whiteSpace: 'pre-wrap',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {dockerCmd}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={copyCmd} className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }}>
                {copied ? 'Copied!' : 'Copy command'}
              </button>
              <button onClick={onClose} style={{ fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the sensors page**

```typescript
// portal/app/dashboard/sensors/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SensorsClient from '@/components/SensorsClient'

export default async function SensorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: sensors } = await supabase
    .from('sensors')
    .select('id, name, location, last_seen, status')
    .eq('tenant_id', profile.tenant_id)
    .order('name', { ascending: true })

  // Asset counts per sensor
  const sensorIds = (sensors ?? []).map(s => s.id)
  const { data: assetRows } = sensorIds.length > 0
    ? await supabase.from('assets').select('sensor_id').in('sensor_id', sensorIds).eq('is_active', true)
    : { data: [] }

  const assetCountMap: Record<string, number> = {}
  for (const a of assetRows ?? []) {
    assetCountMap[a.sensor_id] = (assetCountMap[a.sensor_id] ?? 0) + 1
  }

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>SENSORS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {(sensors ?? []).length} sensor{(sensors ?? []).length !== 1 ? 's' : ''} registered
          </p>
        </div>
      </div>
      <SensorsClient sensors={sensors ?? []} assetCountMap={assetCountMap} />
    </div>
  )
}
```

- [ ] **Step 3: Write SensorsClient (handles Add + Disable interactivity)**

```typescript
// portal/components/SensorsClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SensorRegistrationModal from './SensorRegistrationModal'

interface Sensor {
  id: string
  name: string
  location: string | null
  last_seen: string | null
  status: string
}

interface Props {
  sensors: Sensor[]
  assetCountMap: Record<string, number>
}

export default function SensorsClient({ sensors, assetCountMap }: Props) {
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  function isActive(sensor: Sensor) {
    if (!sensor.last_seen) return false
    return new Date(sensor.last_seen) > new Date(Date.now() - 5 * 60 * 1000)
  }

  function handleModalClose() {
    setShowModal(false)
    router.refresh()
  }

  return (
    <>
      {showModal && <SensorRegistrationModal onClose={handleModalClose} />}

      <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowModal(true)} className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }}>
          + Add sensor
        </button>
      </div>

      <div className="gs au1" style={{ padding: 24 }}>
        {sensors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>No sensors yet</p>
            <p style={{ fontSize: 13 }}>Click "Add sensor" to register your first network sensor.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Location</th><th>Status</th><th>Assets</th><th>Last seen</th></tr>
            </thead>
            <tbody>
              {sensors.map(s => (
                <tr key={s.id}>
                  <td style={{ fontSize: 13, color: '#e2e8f0' }}>{s.name}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{s.location ?? '—'}</td>
                  <td>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                      background: isActive(s) ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
                      color: isActive(s) ? '#22c55e' : '#64748b',
                      border: `1px solid ${isActive(s) ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)'}`,
                    }}>
                      {isActive(s) ? 'Active' : 'Offline'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{assetCountMap[s.id] ?? 0}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>
                    {s.last_seen ? new Date(s.last_seen).toLocaleString('en-GB') : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 4: Verify sensors page**

Open http://localhost:3000/dashboard/sensors. Confirm the "Add sensor" button opens the modal, you can fill in a name, and after clicking "Register sensor" you see the Docker run command with a token. Click "Done" — confirm the new sensor appears in the table.

- [ ] **Step 5: Commit**

```bash
git add portal/app/dashboard/sensors/page.tsx \
        portal/components/SensorsClient.tsx \
        portal/components/SensorRegistrationModal.tsx
git commit -m "feat: add sensors management page and registration modal"
```

---

## Task 9: Sensor Python Package — Models & Scaffold

**Files:**
- Create: `sensor/` directory at repo root
- Create: `sensor/models.py`
- Create: `sensor/requirements.txt`
- Create: `sensor/Dockerfile`
- Create: `sensor/tests/__init__.py`
- Create: `sensor/tests/test_models.py`

- [ ] **Step 1: Create sensor directory and files**

```bash
mkdir -p /path/to/breachr/sensor/tests
```

(Use the actual repo root path.)

- [ ] **Step 2: Write models.py**

```python
# sensor/models.py
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Port:
    port: int
    protocol: str  # 'tcp' | 'udp'
    service: Optional[str] = None
    banner: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            'port': self.port,
            'protocol': self.protocol,
            'service': self.service,
            'banner': self.banner,
        }


@dataclass
class Asset:
    mac: str           # normalised lowercase, colon-separated
    ip: str
    hostname: Optional[str] = None
    vendor: Optional[str] = None
    os_guess: Optional[str] = None
    ports: list[Port] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            'mac': self.mac,
            'ip': self.ip,
            'hostname': self.hostname,
            'vendor': self.vendor,
            'os_guess': self.os_guess,
            'ports': [p.to_dict() for p in self.ports],
        }

    @staticmethod
    def normalise_mac(mac: str) -> str:
        """Normalise MAC to lowercase colon-separated: aa:bb:cc:dd:ee:ff"""
        cleaned = mac.replace('-', ':').replace('.', ':').lower()
        parts = cleaned.split(':')
        if len(parts) == 1 and len(cleaned) == 12:
            parts = [cleaned[i:i+2] for i in range(0, 12, 2)]
        return ':'.join(parts)
```

- [ ] **Step 3: Write tests/test_models.py**

```python
# sensor/tests/test_models.py
import pytest
from models import Asset, Port


def test_port_to_dict():
    p = Port(port=22, protocol='tcp', service='ssh', banner='OpenSSH_9.0')
    assert p.to_dict() == {
        'port': 22, 'protocol': 'tcp', 'service': 'ssh', 'banner': 'OpenSSH_9.0'
    }


def test_port_optional_fields():
    p = Port(port=80, protocol='tcp')
    d = p.to_dict()
    assert d['service'] is None
    assert d['banner'] is None


def test_asset_to_dict_includes_ports():
    a = Asset(
        mac='aa:bb:cc:dd:ee:ff',
        ip='192.168.1.1',
        hostname='router.local',
        ports=[Port(port=80, protocol='tcp')],
    )
    d = a.to_dict()
    assert d['mac'] == 'aa:bb:cc:dd:ee:ff'
    assert len(d['ports']) == 1
    assert d['ports'][0]['port'] == 80


def test_normalise_mac_colon():
    assert Asset.normalise_mac('AA:BB:CC:DD:EE:FF') == 'aa:bb:cc:dd:ee:ff'


def test_normalise_mac_dash():
    assert Asset.normalise_mac('AA-BB-CC-DD-EE-FF') == 'aa:bb:cc:dd:ee:ff'


def test_normalise_mac_no_separator():
    assert Asset.normalise_mac('AABBCCDDEEFF') == 'aa:bb:cc:dd:ee:ff'
```

- [ ] **Step 4: Run tests**

```bash
cd sensor && pip install pytest && pytest tests/test_models.py -v
```

Expected:

```
tests/test_models.py::test_port_to_dict PASSED
tests/test_models.py::test_port_optional_fields PASSED
tests/test_models.py::test_asset_to_dict_includes_ports PASSED
tests/test_models.py::test_normalise_mac_colon PASSED
tests/test_models.py::test_normalise_mac_dash PASSED
tests/test_models.py::test_normalise_mac_no_separator PASSED
6 passed
```

- [ ] **Step 5: Write requirements.txt**

```
scapy>=2.5.0
python-nmap>=0.7.1
httpx>=0.28.0
schedule>=1.2.0
python-dotenv>=1.0.0
pytest>=8.0.0
```

- [ ] **Step 6: Write Dockerfile**

```dockerfile
# sensor/Dockerfile
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    libpcap-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
```

- [ ] **Step 7: Commit**

```bash
git add sensor/
git commit -m "feat: sensor scaffold — models, Dockerfile, requirements"
```

---

## Task 10: Sensor Passive Listener

**Files:**
- Create: `sensor/listener.py`
- Create: `sensor/tests/test_listener.py`

- [ ] **Step 1: Write tests first**

```python
# sensor/tests/test_listener.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from unittest.mock import MagicMock, patch
from listener import parse_arp_packet, parse_dhcp_packet, Listener
from models import Asset


def _make_pkt(fields: dict):
    """Minimal fake scapy packet."""
    pkt = MagicMock()
    pkt.__contains__ = lambda self, key: key in fields
    pkt.__getitem__ = lambda self, key: MagicMock(**fields[key])
    return pkt


def test_parse_arp_packet_returns_asset():
    pkt = _make_pkt({
        'ARP': {'op': 1, 'psrc': '192.168.1.5', 'hwsrc': 'aa:bb:cc:dd:ee:ff'},
    })
    asset = parse_arp_packet(pkt)
    assert asset is not None
    assert asset.ip == '192.168.1.5'
    assert asset.mac == 'aa:bb:cc:dd:ee:ff'


def test_parse_arp_packet_ignores_broadcast():
    pkt = _make_pkt({
        'ARP': {'op': 1, 'psrc': '0.0.0.0', 'hwsrc': 'ff:ff:ff:ff:ff:ff'},
    })
    assert parse_arp_packet(pkt) is None


def test_parse_dhcp_packet_extracts_hostname():
    opts = [('hostname', b'my-laptop'), ('message-type', 3), ('end', '')]
    pkt = _make_pkt({
        'IP': {'src': '192.168.1.10'},
        'Ether': {'src': 'aa:bb:cc:11:22:33'},
        'DHCP': {'options': opts},
    })
    asset = parse_dhcp_packet(pkt)
    assert asset is not None
    assert asset.hostname == 'my-laptop'
    assert asset.ip == '192.168.1.10'


def test_listener_update_merges_fields():
    state: dict[str, Asset] = {}
    listener = Listener(state)

    a1 = Asset(mac='aa:bb:cc:dd:ee:ff', ip='10.0.0.1', hostname='device.local')
    listener._update(a1)
    assert state['aa:bb:cc:dd:ee:ff'].hostname == 'device.local'

    # Second update with same mac should update IP but keep hostname
    a2 = Asset(mac='aa:bb:cc:dd:ee:ff', ip='10.0.0.2')
    listener._update(a2)
    assert state['aa:bb:cc:dd:ee:ff'].ip == '10.0.0.2'
    assert state['aa:bb:cc:dd:ee:ff'].hostname == 'device.local'
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd sensor && pytest tests/test_listener.py -v
```

Expected: `ImportError: cannot import name 'parse_arp_packet' from 'listener'`

- [ ] **Step 3: Write listener.py**

```python
# sensor/listener.py
import threading
from typing import Optional
from models import Asset

try:
    from scapy.all import sniff, ARP, DHCP, IP, Ether
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False


def parse_arp_packet(pkt) -> Optional[Asset]:
    """Extract Asset from an ARP packet. Returns None for broadcast/invalid."""
    if 'ARP' not in pkt:
        return None
    arp = pkt['ARP']
    ip = arp.psrc
    mac = arp.hwsrc
    if ip == '0.0.0.0' or mac == 'ff:ff:ff:ff:ff:ff':
        return None
    return Asset(mac=Asset.normalise_mac(mac), ip=ip)


def parse_dhcp_packet(pkt) -> Optional[Asset]:
    """Extract hostname from a DHCP request packet."""
    if 'DHCP' not in pkt or 'IP' not in pkt:
        return None
    ip = pkt['IP'].src
    mac = pkt['Ether'].src if 'Ether' in pkt else None
    if not mac:
        return None

    hostname: Optional[str] = None
    for opt in pkt['DHCP'].options:
        if isinstance(opt, tuple) and opt[0] == 'hostname':
            raw = opt[1]
            hostname = raw.decode('utf-8', errors='replace') if isinstance(raw, bytes) else str(raw)

    return Asset(mac=Asset.normalise_mac(mac), ip=ip, hostname=hostname)


class Listener:
    def __init__(self, state: dict):
        self._state = state
        self._lock = threading.Lock()

    def _update(self, asset: Asset) -> None:
        with self._lock:
            existing = self._state.get(asset.mac)
            if existing is None:
                self._state[asset.mac] = asset
            else:
                existing.ip = asset.ip
                if asset.hostname and not existing.hostname:
                    existing.hostname = asset.hostname
                if asset.vendor and not existing.vendor:
                    existing.vendor = asset.vendor
                if asset.os_guess and not existing.os_guess:
                    existing.os_guess = asset.os_guess

    def _handle_packet(self, pkt) -> None:
        asset = parse_arp_packet(pkt) or parse_dhcp_packet(pkt)
        if asset:
            self._update(asset)

    def start(self) -> None:
        """Start passive sniffing in the current thread (blocking)."""
        if not SCAPY_AVAILABLE:
            print('[listener] scapy not available — passive listening disabled')
            return
        print('[listener] starting passive ARP/DHCP sniff...')
        sniff(filter='arp or (udp and port 67)', prn=self._handle_packet, store=False)
```

- [ ] **Step 4: Run tests again**

```bash
cd sensor && pytest tests/test_listener.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add sensor/listener.py sensor/tests/test_listener.py
git commit -m "feat: sensor passive ARP/DHCP listener"
```

---

## Task 11: Sensor Heartbeat Client

**Files:**
- Create: `sensor/heartbeat.py`
- Create: `sensor/tests/test_heartbeat.py`

- [ ] **Step 1: Write tests first**

```python
# sensor/tests/test_heartbeat.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from unittest.mock import patch, MagicMock
from heartbeat import HeartbeatClient
from models import Asset, Port


def make_client(api_url='http://localhost:3000', sensor_id='test-id', token='test-token'):
    return HeartbeatClient(api_url=api_url, sensor_id=sensor_id, token=token, max_retries=3, retry_base_s=0.01)


def test_send_success():
    client = make_client()
    state = {
        'aa:bb:cc:dd:ee:ff': Asset(mac='aa:bb:cc:dd:ee:ff', ip='10.0.0.1',
                                    ports=[Port(port=22, protocol='tcp')])
    }
    mock_resp = MagicMock(status_code=200)
    mock_resp.json.return_value = {'upserted': 1}

    with patch('heartbeat.httpx.post', return_value=mock_resp) as mock_post:
        result = client.send(state)

    assert result is True
    call_args = mock_post.call_args
    payload = call_args.kwargs['json']
    assert len(payload['assets']) == 1
    assert payload['assets'][0]['mac'] == 'aa:bb:cc:dd:ee:ff'
    assert payload['assets'][0]['ports'][0]['port'] == 22


def test_send_raises_on_401():
    client = make_client()
    mock_resp = MagicMock(status_code=401)
    with patch('heartbeat.httpx.post', return_value=mock_resp):
        with pytest.raises(PermissionError, match='401'):
            client.send({})


def test_send_retries_on_network_error():
    client = make_client()
    import httpx
    with patch('heartbeat.httpx.post', side_effect=[httpx.ConnectError('timeout'), MagicMock(status_code=200, json=lambda: {'upserted': 0})]) as mock_post:
        result = client.send({})
    assert result is True
    assert mock_post.call_count == 2


def test_send_returns_false_after_max_retries():
    client = make_client()
    import httpx
    with patch('heartbeat.httpx.post', side_effect=httpx.ConnectError('timeout')):
        result = client.send({})
    assert result is False
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd sensor && pytest tests/test_heartbeat.py -v
```

Expected: `ImportError: No module named 'heartbeat'`

- [ ] **Step 3: Write heartbeat.py**

```python
# sensor/heartbeat.py
import time
import httpx
from models import Asset


class HeartbeatClient:
    def __init__(self, api_url: str, sensor_id: str, token: str,
                 max_retries: int = 5, retry_base_s: float = 2.0):
        self._url = f'{api_url}/api/sensors/{sensor_id}/heartbeat'
        self._headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        self._max_retries = max_retries
        self._retry_base_s = retry_base_s

    def send(self, state: dict[str, Asset]) -> bool:
        """Send current asset state. Returns True on success, False after exhausting retries.
        Raises PermissionError on 401 (token invalid — stop retrying)."""
        payload = {'assets': [a.to_dict() for a in state.values()]}

        for attempt in range(self._max_retries):
            try:
                resp = httpx.post(self._url, json=payload, headers=self._headers, timeout=30)
                if resp.status_code == 401:
                    raise PermissionError(f'401 from heartbeat endpoint — token invalid')
                if resp.status_code == 200:
                    return True
                print(f'[heartbeat] unexpected status {resp.status_code} on attempt {attempt + 1}')
            except PermissionError:
                raise
            except Exception as exc:
                print(f'[heartbeat] attempt {attempt + 1}/{self._max_retries} failed: {exc}')

            if attempt < self._max_retries - 1:
                delay = self._retry_base_s * (2 ** attempt)
                time.sleep(delay)

        print('[heartbeat] max retries exhausted — will retry next cycle')
        return False
```

- [ ] **Step 4: Run tests**

```bash
cd sensor && pytest tests/test_heartbeat.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add sensor/heartbeat.py sensor/tests/test_heartbeat.py
git commit -m "feat: sensor heartbeat client with retry/backoff"
```

---

## Task 12: Sensor Active Scanner

**Files:**
- Create: `sensor/scanner.py`
- Create: `sensor/tests/test_scanner.py`

- [ ] **Step 1: Write tests first**

```python
# sensor/tests/test_scanner.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from unittest.mock import patch, MagicMock
from scanner import ActiveScanner, parse_nmap_host
from models import Asset, Port


def make_nmap_host(ip: str, ports: list[dict]) -> MagicMock:
    host = MagicMock()
    host.__str__ = lambda self: ip
    proto = MagicMock()
    proto.keys.return_value = [p['port'] for p in ports]

    def make_port_info(p):
        info = MagicMock()
        info.__getitem__ = lambda self, k: {
            'state': p.get('state', 'open'),
            'name': p.get('name', ''),
            'product': p.get('product', ''),
        }[k]
        return info

    proto.__getitem__ = lambda self, port: make_port_info(next(p for p in ports if p['port'] == port))
    host.__getitem__ = lambda self, key: proto  # nm[host]['tcp']
    host.all_protocols.return_value = ['tcp']
    return host


def test_parse_nmap_host_extracts_ports():
    asset = Asset(mac='aa:bb:cc:dd:ee:ff', ip='10.0.0.1')
    ports_data = [{'port': 22, 'state': 'open', 'name': 'ssh', 'product': 'OpenSSH'}]
    parse_nmap_host(make_nmap_host('10.0.0.1', ports_data), asset, 'tcp')
    assert len(asset.ports) == 1
    assert asset.ports[0].port == 22
    assert asset.ports[0].protocol == 'tcp'
    assert asset.ports[0].service == 'ssh'


def test_parse_nmap_host_skips_closed_ports():
    asset = Asset(mac='aa:bb:cc:dd:ee:ff', ip='10.0.0.1')
    ports_data = [{'port': 443, 'state': 'closed', 'name': 'https', 'product': ''}]
    parse_nmap_host(make_nmap_host('10.0.0.1', ports_data), asset, 'tcp')
    assert len(asset.ports) == 0


def test_scanner_skips_when_disabled(monkeypatch):
    monkeypatch.setenv('BREACHR_ACTIVE_SCAN', 'false')
    import importlib, scanner
    importlib.reload(scanner)
    s = scanner.ActiveScanner()
    state = {'aa:bb:cc:dd:ee:ff': Asset(mac='aa:bb:cc:dd:ee:ff', ip='10.0.0.1')}
    with patch('scanner.nmap') as mock_nmap:
        s.scan(state)
    mock_nmap.PortScanner.assert_not_called()
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd sensor && pytest tests/test_scanner.py -v
```

Expected: `ImportError: No module named 'scanner'`

- [ ] **Step 3: Write scanner.py**

```python
# sensor/scanner.py
import os
from typing import Optional
from models import Asset, Port

try:
    import nmap
    NMAP_AVAILABLE = True
except ImportError:
    NMAP_AVAILABLE = False

ACTIVE_SCAN = os.getenv('BREACHR_ACTIVE_SCAN', 'true').lower() != 'false'


def parse_nmap_host(host, asset: Asset, protocol: str) -> None:
    """Parse open ports from an nmap scan result into the asset's ports list."""
    proto_data = host[protocol]
    for port in proto_data.keys():
        info = proto_data[port]
        if info['state'] != 'open':
            continue
        banner = info['product'] or None
        existing = next((p for p in asset.ports if p.port == port and p.protocol == protocol), None)
        if existing:
            existing.banner = banner or existing.banner
        else:
            asset.ports.append(Port(
                port=port,
                protocol=protocol,
                service=info['name'] or None,
                banner=banner,
            ))


class ActiveScanner:
    def scan(self, state: dict[str, Asset]) -> None:
        """Run nmap against all known IPs and update ports in state."""
        if not ACTIVE_SCAN:
            print('[scanner] active scanning disabled — skipping')
            return
        if not NMAP_AVAILABLE:
            print('[scanner] nmap not available — skipping')
            return
        if not state:
            return

        ips = ' '.join(a.ip for a in state.values())
        print(f'[scanner] scanning {len(state)} hosts...')
        nm = nmap.PortScanner()
        nm.scan(hosts=ips, arguments='-sV -T4 --top-ports 1000')

        for mac, asset in state.items():
            if asset.ip not in nm.all_hosts():
                continue
            host = nm[asset.ip]
            for protocol in host.all_protocols():
                parse_nmap_host(host, asset, protocol)

        print(f'[scanner] scan complete')
```

- [ ] **Step 4: Run tests**

```bash
cd sensor && pytest tests/test_scanner.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add sensor/scanner.py sensor/tests/test_scanner.py
git commit -m "feat: sensor active nmap scanner"
```

---

## Task 13: Sensor Main Entrypoint

**Files:**
- Create: `sensor/main.py`
- Create: `sensor/tests/__init__.py`

- [ ] **Step 1: Write main.py**

```python
# sensor/main.py
import os
import sys
import time
import threading
import schedule
from dotenv import load_dotenv
from models import Asset
from listener import Listener
from heartbeat import HeartbeatClient
from scanner import ActiveScanner

load_dotenv()

SENSOR_TOKEN = os.environ.get('BREACHR_SENSOR_TOKEN', '')
SENSOR_ID    = os.environ.get('BREACHR_SENSOR_ID', '')
API_URL      = os.environ.get('BREACHR_API_URL', '')
ACTIVE_INTERVAL_HOURS = int(os.environ.get('BREACHR_ACTIVE_INTERVAL_HOURS', '4'))

if not SENSOR_TOKEN or not SENSOR_ID or not API_URL:
    print('ERROR: BREACHR_SENSOR_TOKEN, BREACHR_SENSOR_ID, and BREACHR_API_URL are required')
    sys.exit(1)

state: dict[str, Asset] = {}
state_lock = threading.Lock()

client  = HeartbeatClient(api_url=API_URL, sensor_id=SENSOR_ID, token=SENSOR_TOKEN)
scanner = ActiveScanner()


def send_heartbeat():
    with state_lock:
        snapshot = dict(state)
    try:
        client.send(snapshot)
    except PermissionError as e:
        print(f'[main] {e} — stopping scheduler')
        sys.exit(1)


def run_active_scan():
    with state_lock:
        snapshot = dict(state)
    scanner.scan(snapshot)
    with state_lock:
        for mac, asset in snapshot.items():
            if mac in state:
                state[mac].ports = asset.ports


def run_scheduler():
    schedule.every(60).seconds.do(send_heartbeat)
    schedule.every(ACTIVE_INTERVAL_HOURS).hours.do(run_active_scan)

    # Run immediately on startup
    send_heartbeat()
    run_active_scan()

    while True:
        schedule.run_pending()
        time.sleep(5)


if __name__ == '__main__':
    listener = Listener(state)
    sched_thread = threading.Thread(target=run_scheduler, daemon=True)
    sched_thread.start()
    listener.start()  # blocks — passive sniffing runs in main thread
```

- [ ] **Step 2: Create tests/__init__.py**

Create an empty file at `sensor/tests/__init__.py`.

- [ ] **Step 3: Run all sensor tests**

```bash
cd sensor && pytest tests/ -v
```

Expected:

```
tests/test_models.py::test_port_to_dict PASSED
tests/test_models.py::test_port_optional_fields PASSED
tests/test_models.py::test_asset_to_dict_includes_ports PASSED
tests/test_models.py::test_normalise_mac_colon PASSED
tests/test_models.py::test_normalise_mac_dash PASSED
tests/test_models.py::test_normalise_mac_no_separator PASSED
tests/test_listener.py::test_parse_arp_packet_returns_asset PASSED
tests/test_listener.py::test_parse_arp_packet_ignores_broadcast PASSED
tests/test_listener.py::test_parse_dhcp_packet_extracts_hostname PASSED
tests/test_listener.py::test_listener_update_merges_fields PASSED
tests/test_heartbeat.py::test_send_success PASSED
tests/test_heartbeat.py::test_send_raises_on_401 PASSED
tests/test_heartbeat.py::test_send_retries_on_network_error PASSED
tests/test_heartbeat.py::test_send_returns_false_after_max_retries PASSED
tests/test_scanner.py::test_parse_nmap_host_extracts_ports PASSED
tests/test_scanner.py::test_parse_nmap_host_skips_closed_ports PASSED
tests/test_scanner.py::test_scanner_skips_when_disabled PASSED
17 passed
```

- [ ] **Step 4: Build the Docker image (local test)**

```bash
cd sensor && docker build -t breachr-sensor:local .
```

Expected: image builds without errors.

- [ ] **Step 5: Run the sensor container against local portal**

Register a sensor via the portal UI (Task 8), copy the sensor ID and token, then:

```bash
docker run --rm --network host \
  -e BREACHR_SENSOR_TOKEN=<token> \
  -e BREACHR_SENSOR_ID=<id> \
  -e BREACHR_API_URL=http://localhost:3000 \
  breachr-sensor:local
```

Expected output:
```
[heartbeat] sending 0 assets...
[scanner] scanning 0 hosts...
```

Within 60s of devices appearing on the network, assets should appear in http://localhost:3000/dashboard/inventory.

- [ ] **Step 6: Commit**

```bash
git add sensor/main.py sensor/tests/__init__.py
git commit -m "feat: sensor main entrypoint with passive + active + heartbeat threads"
```

---

## Task 14: Deploy to Vercel

**Files:**
- None (deployment only)

- [ ] **Step 1: Verify env vars are set in Vercel**

In Vercel dashboard → project → Settings → Environment Variables, confirm these exist:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` (set a random 32-char value, e.g. `openssl rand -hex 16`)

- [ ] **Step 2: Deploy**

```bash
cd portal && vercel --prod
```

- [ ] **Step 3: Verify cron is registered**

In Vercel dashboard → project → Settings → Crons. Confirm `/api/crons/cve-enrichment` appears with schedule `0 2 * * *`.

- [ ] **Step 4: Smoke-test the production heartbeat endpoint**

Register a sensor via the production portal, then:

```bash
curl -X POST https://breachr-portal.vercel.app/api/sensors/<id>/heartbeat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"assets": []}'
```

Expected: `{ "upserted": 0 }`

- [ ] **Step 5: Commit any final fixes and tag**

```bash
git tag v0.5.0-asset-discovery
git push && git push --tags
```
