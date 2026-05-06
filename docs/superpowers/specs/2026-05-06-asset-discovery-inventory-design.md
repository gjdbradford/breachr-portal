# Asset Discovery & Inventory Module Design

## Goal

Add a Docker-based network sensor that passively (and optionally actively) discovers internal network assets, correlates them against NVD CVE data, and surfaces a risk-scored asset inventory inside the Breachr portal — satisfying DORA Art. 8, NIS2 Art. 21, and PCI-DSS Req 12.5 asset management requirements.

## Architecture

**Option chosen: B — Portal API Routes**

Sensor containers deployed in customer networks phone home to new Next.js API routes on the existing Vercel portal. API routes write to Supabase using the service role key (same pattern as the scanner). The portal gains three new pages for inventory and sensor management. CVE enrichment runs as a nightly Vercel cron job.

```
Customer network
┌─────────────────────────────────────────────┐
│  Docker Sensor (Python)                      │
│  · Passive: ARP sniff, mDNS, DHCP watch     │
│  · Active: nmap scan (opt-in, scheduled)     │
│  · Queues state locally between phone-homes  │
└──────────────┬──────────────────────────────┘
               │ HTTPS POST every 60–300s
               │ Authorization: Bearer <sensor-token>
               ▼
Breachr cloud (Vercel)
┌─────────────────────────────────────────────┐
│  Next.js API routes                          │
│  POST /api/sensors                  register │
│  POST /api/sensors/[id]/heartbeat   ingest   │
│  GET  /api/inventory                portal   │
└──────────────┬──────────────────────────────┘
               │ service role write
               ▼
┌─────────────────────────────────────────────┐
│  Supabase Postgres                           │
│  sensors · assets · asset_ports             │
│  asset_vulns · cve_cache                    │
└─────────────────────────────────────────────┘
               ▲ Vercel cron (nightly)
               │ NVD 2.0 API → CVE enrichment
```

## Tech Stack

- **Sensor:** Python 3.12, scapy, python-nmap, httpx, schedule
- **API routes:** Next.js App Router (existing portal), Zod for payload validation
- **Database:** Supabase Postgres (existing project), service role client for writes
- **Enrichment:** Vercel cron (`/api/crons/cve-enrichment`), NVD 2.0 API
- **Container registry:** GitHub Container Registry (`ghcr.io/breachr/sensor`)

---

## Data Model

Five new tables. All include `tenant_id` for RLS enforcement. Sensor writes use the service role key and bypass RLS; portal reads use the anon key with RLS policies.

### `sensors`

```sql
CREATE TABLE sensors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  token_hash  text NOT NULL,       -- bcrypt of the plaintext token shown once
  location    text,                -- free-text, e.g. "London Office"
  last_seen   timestamptz,
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'offline', 'disabled')),
  config      jsonb NOT NULL DEFAULT '{}'  -- active_interval_hours, excluded_ranges
);
```

### `assets`

```sql
CREATE TABLE assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sensor_id   uuid NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  ip          inet NOT NULL,
  mac         macaddr NOT NULL,
  hostname    text,
  vendor      text,               -- OUI lookup
  os_guess    text,               -- DHCP option 55 / nmap fingerprint
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  is_active   bool NOT NULL DEFAULT true,
  risk_score  int NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  UNIQUE (tenant_id, mac)
);
```

### `asset_ports`

```sql
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
```

### `asset_vulns`

```sql
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
```

### `cve_cache`

```sql
CREATE TABLE cve_cache (
  cve_id      text PRIMARY KEY,
  data        jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
```

### RLS policies

- `sensors`, `assets`, `asset_ports`, `asset_vulns`: `SELECT` where `tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())`
- No `INSERT`/`UPDATE`/`DELETE` via anon key — all writes go through the service role in API routes

---

## API Routes

### `POST /api/sensors`

Registers a new sensor for the authenticated tenant. Generates a random token, stores its bcrypt hash, returns the plaintext token once.

**Auth:** Supabase session cookie (portal user)

**Request body:**
```json
{ "name": "Office London", "location": "2nd floor server room" }
```

**Response:**
```json
{ "id": "<uuid>", "token": "<plaintext — show once>" }
```

---

### `POST /api/sensors/[id]/heartbeat`

Receives a batch of discovered assets and ports from the sensor. Upserts assets on `(tenant_id, mac)` — only `ip`, `last_seen`, `is_active` are overwritten on conflict; `hostname` and `os_guess` are only set if not already present. Upserts ports on `(asset_id, port, protocol)`.

**Auth:** `Authorization: Bearer <sensor-token>` — validated against `token_hash` in `sensors` table using bcrypt compare. Returns 401 on mismatch.

**Request body (Zod-validated):**
```json
{
  "assets": [
    {
      "ip": "192.168.1.42",
      "mac": "aa:bb:cc:dd:ee:ff",
      "hostname": "macbook-pro-graham.local",
      "vendor": "Apple Inc.",
      "os_guess": "macOS",
      "ports": [
        { "port": 22, "protocol": "tcp", "service": "ssh", "banner": "OpenSSH_9.0" }
      ]
    }
  ]
}
```

**Response:** `{ "upserted": 3 }`

Updates `sensors.last_seen` on every successful heartbeat. After upserting the incoming assets, marks any asset belonging to this sensor whose `last_seen < now() - interval '24 hours'` as `is_active = false`.

---

### `GET /api/inventory` (internal — used by portal server components)

Not a public REST endpoint; portal pages query Supabase directly as server components. This route is not needed.

---

## Portal Pages

### `/dashboard/inventory`

Server component. Queries `assets` with `is_active = true`, ordered by `risk_score DESC`.

- Risk overview bar: counts of critical/high/medium/low risk assets
- Filterable table: IP · hostname · vendor · OS · open port count · risk score · last seen
- `is_active` badge: grey "Offline" if `last_seen < now() - interval '24 hours'`
- Row click → `/dashboard/inventory/[assetId]`

### `/dashboard/inventory/[assetId]`

Server component. Fetches asset + ports + vulns in parallel.

- Header: IP, MAC, hostname, vendor, OS, first/last seen, sensor location
- Open ports table: port · protocol · service · banner · last seen
- CVE findings: severity badge · CVSS score · CVE ID · title
- Back link to inventory list

### `/dashboard/sensors`

Server component. Lists sensors with status, last heartbeat, asset count (via `COUNT(assets)`).

- Status: "Active" (green) if `last_seen > now() - interval '5 minutes'`, else "Offline" (grey)
- "Add sensor" button → modal flow:
  1. Enter name + location
  2. POST `/api/sensors` → receive token
  3. Show Docker run command with token pre-filled (copy button)
  4. Token is shown once; user must copy it before closing
- Rename / disable sensor inline

---

## Docker Sensor

### Container behaviour

Single Python container, two concurrent threads:

**Thread 1 — Passive listener (always running)**
- `scapy` ARP sniff: captures IP/MAC pairs as devices communicate
- Listens for mDNS/DNS-SD: extracts hostnames
- Listens for DHCP: extracts hostnames and DHCP option 55 (OS fingerprinting)
- Accumulates into an in-memory `state: dict[str, Asset]` keyed by MAC

**Thread 2 — Scheduler**
- Every 60s: POST current state to `/api/sensors/[id]/heartbeat`
  - On failure: exponential backoff, max 5 retries, then queue and retry on next cycle
  - On 401: log error, stop retrying (token invalid — requires container restart)
- Every N hours (default 4, configurable via `BREACHR_ACTIVE_INTERVAL_HOURS`):
  - `python-nmap` sweep of discovered IP ranges
  - Adds open ports and banners to state
  - Active scanning is disabled if `BREACHR_ACTIVE_SCAN=false`

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `BREACHR_SENSOR_TOKEN` | yes | Plaintext token from portal registration |
| `BREACHR_SENSOR_ID` | yes | Sensor UUID from portal registration |
| `BREACHR_API_URL` | yes | Portal base URL e.g. `https://portal.breachr.io` |
| `BREACHR_ACTIVE_SCAN` | no | `true` / `false` (default `true`) |
| `BREACHR_ACTIVE_INTERVAL_HOURS` | no | Default `4` |

### Docker run command (shown in portal)

```bash
docker run -d --network host \
  -e BREACHR_SENSOR_TOKEN=<token> \
  -e BREACHR_SENSOR_ID=<id> \
  -e BREACHR_API_URL=https://portal.breachr.io \
  ghcr.io/breachr/sensor:latest
```

`--network host` is required for ARP sniffing. No inbound ports. Container is stateless — state is rebuilt from the network on restart; no volume mounts required.

---

## CVE Enrichment

### Vercel cron: `GET /api/crons/cve-enrichment`

Runs nightly at 02:00 UTC. Protected by `Authorization: Bearer <CRON_SECRET>` (Vercel injects this automatically for cron routes).

**Steps:**
1. Fetch CVEs modified in the last 24h from NVD 2.0 API (paginated, 2000 per page, 600ms delay between pages to respect rate limits)
2. Upsert into `cve_cache`
3. For each asset with a non-null `os_guess`, match against CVE CPE data in `cve_cache`
4. For each asset with ports, match service banners against CVE descriptions
5. Upsert matches into `asset_vulns`
6. Recalculate `risk_score` for affected assets:
   - critical CVE → +40 pts
   - high → +20 pts
   - medium → +10 pts
   - capped at 100
7. Update `assets.risk_score`

If NVD API is unreachable, log and exit cleanly — existing `asset_vulns` rows are not deleted.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Sensor heartbeat fails (network) | Retry with backoff; queue state locally |
| Sensor token invalid (401) | Stop retrying; log error; require restart |
| Malformed heartbeat payload | API returns 400; sensor logs and skips cycle |
| Unknown MAC in heartbeat | Upsert as new asset |
| Known MAC, different IP | Update `ip` and `last_seen` (roaming device) |
| NVD API unreachable | Cron exits cleanly; existing vuln data preserved |
| Asset not seen for 24h | API marks `is_active = false` after processing each heartbeat (any asset from this sensor with `last_seen` older than 24h) |

---

## Testing Strategy

**Sensor (pytest):**
- Unit: ARP packet parser, mDNS parser, DHCP option 55 parser, payload builder
- Unit: Retry/backoff logic with mocked httpx responses
- Integration: POST a crafted heartbeat payload to a local Next.js dev server; assert DB row count

**API routes (Vitest):**
- Unit: token validation logic with mocked bcrypt and Supabase client
- Unit: Zod schema rejects invalid payloads (missing fields, bad IP format, port out of range)
- Integration: one test per route against the test tenant in Supabase

**CVE cron (pytest):**
- Unit: NVD response parser extracts correct CPE strings
- Unit: risk score calculator produces correct totals for known inputs
- Unit: upsert logic handles new / updated / unchanged CVEs correctly

**Portal UI (manual smoke test):**
1. Register sensor in portal → copy Docker run command
2. Run sensor container in test network
3. Verify heartbeat arrives → asset appears in `/dashboard/inventory`
4. Verify CVE enrichment populates `/dashboard/inventory/[assetId]`
5. Disable sensor → status shows "Offline"
