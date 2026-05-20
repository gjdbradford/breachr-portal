# Asset Discovery & Inventory — Feature Guide

## What Was Built

The asset discovery module lets you deploy a lightweight Docker sensor inside a customer network. The sensor silently monitors network traffic, discovers every device on the local network, and sends that information back to the Breachr portal. The portal then correlates discovered devices against the NVD CVE database to flag known vulnerabilities and produce a risk score for each device.

This satisfies the asset inventory requirements of:
- **DORA Art. 8** — ICT asset management
- **NIS2 Art. 21** — Security of network and information systems
- **PCI-DSS Req 12.5** — Maintain an inventory of system components

---

## How It Works End-to-End

```
Your customer's network
  ↓
Docker sensor (passive ARP + optional nmap)
  ↓ HTTPS every 60s
Portal API (/api/sensors/[id]/heartbeat)
  ↓
Supabase database (assets, ports, vulns)
  ↑
Nightly cron → NVD CVE feed → risk scores
  ↑
Portal UI (/dashboard/inventory)
```

### The sensor

A Python Docker container that you run on any machine inside the target network (a Raspberry Pi, an old laptop, a VM). It needs no inbound ports and no firewall exceptions — it only makes outbound HTTPS calls to your portal.

- **Passive mode (always on):** Listens to network broadcast traffic (ARP, mDNS, DHCP) to silently identify every device that communicates on the network. Picks up IP addresses, MAC addresses, hostnames, and OS hints without sending a single packet.
- **Active mode (opt-in, every 4h by default):** Runs nmap against all discovered IPs to find open ports and service banners. Can be disabled with `BREACHR_ACTIVE_SCAN=false`.

### The heartbeat API

Every 60 seconds the sensor POSTs a batch of up to 500 discovered assets to `/api/sensors/[id]/heartbeat`. The API:
1. Validates the sensor's bearer token (bcrypt hash comparison)
2. Upserts each asset — preserves manually-edited hostnames/OS guesses via `COALESCE`
3. Upserts open ports
4. Marks any device not seen in 24h as inactive
5. Updates the sensor's last-seen timestamp

### CVE enrichment cron

Runs nightly at 02:00 UTC. Fetches CVEs modified in the last 24 hours from the NVD 2.0 API, then keyword-matches them against discovered assets (by OS type and open service names/banners). Writes matches to `asset_vulns` and recalculates a 0–100 risk score for each affected asset.

Risk score formula:
- Critical CVE: +40 points
- High CVE: +20 points
- Medium CVE: +10 points
- Capped at 100

---

## New Portal Pages

| Page | URL | What it shows |
|---|---|---|
| Inventory | `/dashboard/inventory` | All discovered assets, risk-sorted. Risk bar at top (critical/high/medium/low counts). Click any row to see detail. |
| Asset detail | `/dashboard/inventory/[assetId]` | Full device info — open ports table, CVE findings with severity and CVSS score. |
| Sensors | `/dashboard/sensors` | List of registered sensors with status (Active/Offline) and asset counts. "Add sensor" button to register new sensors. |

---

## New API Routes

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/sensors` | Session cookie (portal user) | Register a new sensor, returns one-time token |
| `POST /api/sensors/[id]/heartbeat` | Bearer token (sensor) | Ingest asset batch from sensor |
| `GET /api/crons/cve-enrichment` | Bearer CRON_SECRET | Nightly CVE enrichment (called by Vercel cron) |

---

## New Database Tables

| Table | Purpose |
|---|---|
| `sensors` | One row per registered sensor device |
| `assets` | One row per discovered network device (keyed by MAC address) |
| `asset_ports` | Open ports discovered on each asset |
| `asset_vulns` | CVE matches for each asset |
| `cve_cache` | Local cache of NVD CVE data (refreshed nightly) |

---

## How to Set Up (Step by Step)

### 1. Run the SQL migrations in Supabase

Open your Supabase dashboard → SQL Editor. Run these two files in order:

1. `portal/supabase/migrations/20260506_asset_discovery.sql`
2. `portal/supabase/migrations/20260506_asset_discovery_fn.sql`

You should see "Success. No rows returned." for each.

### 2. Add CRON_SECRET to Vercel

In your Vercel project dashboard → Settings → Environment Variables, add:
- **Name:** `CRON_SECRET`
- **Value:** any long random string (e.g. run `openssl rand -hex 32` in terminal)
- **Environment:** Production (and Preview if you want cron to work on preview deploys)

### 3. Deploy the portal to Vercel

```bash
cd portal && vercel --prod
```

After deploy, go to Vercel Dashboard → your project → Settings → Crons. You should see `/api/crons/cve-enrichment` scheduled at `0 2 * * *`.

### 4. Register a sensor in the portal

1. Go to `https://your-portal.vercel.app/dashboard/sensors`
2. Click **Add sensor**
3. Enter a name (e.g. "Office Network") and optional location
4. Click **Register sensor**
5. You'll see a Docker run command — **copy it now** (the token is shown only once)

### 5. Run the sensor

On any machine inside the target network:

```bash
docker run -d --network host \
  -e BREACHR_SENSOR_TOKEN=<token-from-step-4> \
  -e BREACHR_SENSOR_ID=<id-from-step-4> \
  -e BREACHR_API_URL=https://your-portal.vercel.app \
  ghcr.io/breachr/sensor:latest
```

> `--network host` is required for ARP sniffing on Linux. On macOS Docker Desktop, host networking behaves differently — use a Linux VM or server for production deployments.

---

## How to Test When Ready

### Smoke test 1 — Sensor registration

```bash
# Should return { "id": "...", "token": "..." } with status 201
curl -X POST https://your-portal.vercel.app/api/sensors \
  -H "Content-Type: application/json" \
  -H "Cookie: <your session cookie>" \
  -d '{"name": "Test Sensor", "location": "Dev machine"}'
```

### Smoke test 2 — Manual heartbeat (simulate a sensor)

Use the sensor ID and token from step 1:

```bash
curl -X POST https://your-portal.vercel.app/api/sensors/<sensor-id>/heartbeat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
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

Then go to `/dashboard/inventory` — the device should appear immediately.

### Smoke test 3 — CVE enrichment (manual trigger)

```bash
# Trigger the cron manually — should return within a few seconds
curl https://your-portal.vercel.app/api/crons/cve-enrichment \
  -H "Authorization: Bearer <your-CRON_SECRET>"
```

Expected: `{ "ok": true, "cves_fetched": N, "vulns_matched": N, "assets_updated": N }`

After this runs, go to `/dashboard/inventory/<asset-id>` for the test device — if any CVEs matched "macOS" or "ssh", they'll appear in the CVE Findings section.

### Smoke test 4 — Token rejection

```bash
# Should return 401
curl -X POST https://your-portal.vercel.app/api/sensors/<sensor-id>/heartbeat \
  -H "Authorization: Bearer wrongtoken" \
  -H "Content-Type: application/json" \
  -d '{"assets": []}'
```

Expected: `{ "error": "Unauthorized" }` with status 401.

### Smoke test 5 — Sensor status in UI

1. Go to `/dashboard/sensors`
2. Within 5 minutes of the Docker container running, the sensor status should show **Active** (green)
3. Stop the container — after 5 minutes the status shows **Offline** (grey)
4. Check the asset count column — should match the number of devices visible in `/dashboard/inventory`

### Full golden-path test

1. Register a sensor in the portal → copy Docker run command
2. Run the sensor on a machine inside a real network
3. Wait 60–90 seconds
4. Go to `/dashboard/inventory` — devices should start appearing
5. Trigger CVE enrichment manually (smoke test 3)
6. Open any asset → check CVE Findings section
7. Verify risk scores appear on the inventory list (sorted high → low)

---

## Environment Variables Required

| Variable | Where set | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (already set) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel (already set) | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (already set) | Service role key for API writes |
| `CRON_SECRET` | Vercel (new — add this) | Protects the CVE cron endpoint |

---

## Known Limitations (MVP)

- **CVE matching is keyword-based** — matching `os_guess` and service names as keywords against CVE text. This produces some false positives (e.g. any Linux asset may match many Linux CVEs regardless of installed packages). Proper CPE-based matching is a follow-on improvement.
- **macOS Docker networking** — `--network host` doesn't work the same way on macOS Docker Desktop as on Linux. The sensor should be run on a Linux host (server, VM, Raspberry Pi) for production use.
- **No real-time dashboard updates** — the inventory page is a server component and doesn't auto-refresh. Reload the page to see new assets.
- **Risk scores update nightly** — risk scores only change after the CVE cron runs. Manually trigger `/api/crons/cve-enrichment` to force an immediate update.
