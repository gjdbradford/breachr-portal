# Sensor Deployment Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers choose from four sensor deployment types (Docker/Linux, Raspberry Pi, Synology NAS, Native Linux) during sensor registration, store the choice in the DB, and show the correct setup instructions.

**Architecture:** Add `deployment_type` to the `sensors` table, thread it through the POST `/api/sensors` route, and redesign `SensorRegistrationModal` to show a type picker on the registration form and per-type instructions after registration. Raspberry Pi support also requires a multi-arch Docker build.

**Tech Stack:** Next.js (portal), Supabase (Postgres), GitHub Actions (Docker multi-arch build), Python (sensor), systemd (native Linux deployment)

---

## File Map

| File | Change |
|------|--------|
| `sensor/.github/workflows/docker-publish.yml` | Add QEMU + `platforms: linux/amd64,linux/arm64,linux/arm/v7` |
| `portal/components/SensorRegistrationModal.tsx` | Full rewrite — add deployment type picker, per-type instructions |
| `portal/app/api/sensors/route.ts` | Accept and store `deployment_type` from POST body |
| Supabase migration (applied via MCP) | Add `deployment_type` column to `sensors` table |

---

## Task 1: Multi-arch Docker Build (Raspberry Pi ARM support)

**Files:**
- Modify: `sensor/.github/workflows/docker-publish.yml`

- [ ] **Step 1: Add QEMU and platforms to the workflow**

Replace the build-and-push step in `sensor/.github/workflows/docker-publish.yml`. The full updated file:

```yaml
name: Build and push sensor image

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: gjdbradford/sensor
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,prefix=sha-

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          platforms: linux/amd64,linux/arm64,linux/arm/v7
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max,ignore-error=true
```

- [ ] **Step 2: Commit and push sensor repo**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/sensor
git add .github/workflows/docker-publish.yml
git commit -m "ci: build multi-arch image (amd64, arm64, arm/v7)"
git push
```

Expected: GitHub Actions triggers a new build. The image will now run on Raspberry Pi (arm64/armv7) without any other code changes.

---

## Task 2: DB Migration — Add deployment_type to sensors

**Files:**
- Supabase migration applied via MCP tool

- [ ] **Step 1: Apply the migration**

Use the Supabase MCP `apply_migration` tool with project_id `hvdwvzgtfhgntdcnwheu`:

```sql
ALTER TABLE sensors
  ADD COLUMN deployment_type text NOT NULL DEFAULT 'docker'
  CHECK (deployment_type = ANY (ARRAY[
    'docker'::text,
    'pi'::text,
    'synology'::text,
    'native'::text
  ]));
```

Migration name: `add_deployment_type_to_sensors`

- [ ] **Step 2: Verify**

Run via Supabase MCP `execute_sql`:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sensors' AND column_name = 'deployment_type';
```

Expected: one row with `data_type = text`, `column_default = 'docker'`.

---

## Task 3: Update POST /api/sensors to Accept deployment_type

**Files:**
- Modify: `portal/app/api/sensors/route.ts`

- [ ] **Step 1: Add deployment_type parsing and insertion**

Replace `portal/app/api/sensors/route.ts` with:

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

const VALID_DEPLOYMENT_TYPES = ['docker', 'pi', 'synology', 'native'] as const
type DeploymentType = typeof VALID_DEPLOYMENT_TYPES[number]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const rawName = body.name
  const name: string = (typeof rawName === 'string' ? rawName : '').trim()
  const rawLocation = body.location
  const location: string = (typeof rawLocation === 'string' ? rawLocation : '').trim()
  const rawDeploymentType = body.deployment_type
  const deploymentType: DeploymentType =
    VALID_DEPLOYMENT_TYPES.includes(rawDeploymentType) ? rawDeploymentType : 'docker'

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (name.length > 200)
    return NextResponse.json({ error: 'name must be 200 characters or fewer' }, { status: 400 })

  const token = randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(token, 10)

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: sensor, error } = await admin
    .from('sensors')
    .insert({
      tenant_id:       profile.tenant_id,
      name,
      location:        location || null,
      token_hash:      tokenHash,
      deployment_type: deploymentType,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[sensors] insert failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: sensor.id, token }, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
git add app/api/sensors/route.ts
git commit -m "feat: accept deployment_type in POST /api/sensors"
```

---

## Task 4: Redesign SensorRegistrationModal with Deployment Type Picker

**Files:**
- Modify: `portal/components/SensorRegistrationModal.tsx`

The modal has two screens:
1. **Registration form** — name, location, deployment type picker (4 options as cards), Register button
2. **Setup instructions** — appropriate command/guide for the chosen type, token warning, Copy + Done buttons

### Deployment type definitions

```
docker   → "Docker on Linux"      — docker run command (existing)
pi       → "Raspberry Pi"         → same docker run command + Pi-specific notes
synology → "Synology NAS"         → Container Manager GUI steps (no CLI)
native   → "Native Linux (systemd)" → git clone + pip install + systemd unit file
```

- [ ] **Step 1: Replace SensorRegistrationModal.tsx**

```tsx
'use client'

import { useState } from 'react'

type DeploymentType = 'docker' | 'pi' | 'synology' | 'native'

interface Props {
  onClose: () => void
}

const DEPLOYMENT_TYPES: { id: DeploymentType; label: string; sub: string; icon: string }[] = [
  { id: 'docker',   label: 'Docker — Linux',      sub: 'Ubuntu, Debian, CentOS, any Linux host', icon: '🐋' },
  { id: 'pi',       label: 'Raspberry Pi',         sub: 'Pi 3, 4, 5 — dedicated always-on sensor', icon: '🫐' },
  { id: 'synology', label: 'Synology NAS',         sub: 'Container Manager (DSM 7+)',              icon: '💾' },
  { id: 'native',   label: 'Native Linux',         sub: 'systemd service, no Docker required',    icon: '⚙️' },
]

export default function SensorRegistrationModal({ onClose }: Props) {
  const [name, setName]                   = useState('')
  const [location, setLocation]           = useState('')
  const [deploymentType, setDeploymentType] = useState<DeploymentType>('docker')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [result, setResult]               = useState<{ id: string; token: string } | null>(null)
  const [copied, setCopied]               = useState(false)

  const apiUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function handleRegister() {
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/sensors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        location: location.trim(),
        deployment_type: deploymentType,
      }),
    })
    setLoading(false)
    if (!res.ok) { setError((await res.json()).error ?? 'Failed'); return }
    setResult(await res.json())
  }

  const dockerCmd = result
    ? `docker run -d --network host \\\n  --restart unless-stopped \\\n  --cap-add=NET_ADMIN --cap-add=NET_RAW \\\n  -e BREACHR_SENSOR_TOKEN=${result.token} \\\n  -e BREACHR_SENSOR_ID=${result.id} \\\n  -e BREACHR_API_URL=${apiUrl} \\\n  ghcr.io/gjdbradford/sensor:latest`
    : ''

  const systemdUnit = result
    ? `[Unit]
Description=Breachr Network Sensor
After=network.target

[Service]
Type=simple
User=root
Environment=BREACHR_SENSOR_TOKEN=${result.token}
Environment=BREACHR_SENSOR_ID=${result.id}
Environment=BREACHR_API_URL=${apiUrl}
WorkingDirectory=/opt/breachr-sensor
ExecStart=/usr/bin/python3 main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target`
    : ''

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
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
        padding: 32, width: 560, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>Add Sensor</h2>

        {!result ? (
          <>
            {/* Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Office London"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Location */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Location (optional)</label>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="2nd floor server room"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Deployment type picker */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 10 }}>Deployment type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {DEPLOYMENT_TYPES.map(dt => (
                  <button
                    key={dt.id}
                    onClick={() => setDeploymentType(dt.id)}
                    style={{
                      textAlign: 'left', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      background: deploymentType === dt.id ? 'rgba(66,165,245,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${deploymentType === dt.id ? 'rgba(66,165,245,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 16, marginBottom: 4 }}>{dt.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: deploymentType === dt.id ? '#42a5f5' : '#cbd5e1', marginBottom: 2 }}>{dt.label}</div>
                    <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>{dt.sub}</div>
                  </button>
                ))}
              </div>
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
          <SetupInstructions
            deploymentType={deploymentType}
            dockerCmd={dockerCmd}
            systemdUnit={systemdUnit}
            sensorId={result.id}
            token={result.token}
            apiUrl={apiUrl}
            copied={copied}
            onCopy={copyText}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}

function SetupInstructions({
  deploymentType, dockerCmd, systemdUnit, sensorId, token, apiUrl, copied, onCopy, onClose,
}: {
  deploymentType: DeploymentType
  dockerCmd: string
  systemdUnit: string
  sensorId: string
  token: string
  apiUrl: string
  copied: boolean
  onCopy: (text: string) => void
  onClose: () => void
}) {
  const tokenWarning = (
    <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 1.6 }}>
      Sensor registered.{' '}
      <strong style={{ color: '#ef4444' }}>Copy the token now — it will not be shown again.</strong>
    </p>
  )

  const codeBlock = (text: string) => (
    <div style={{
      background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 16, marginBottom: 12,
      fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', whiteSpace: 'pre-wrap',
      border: '1px solid rgba(255,255,255,0.08)', wordBreak: 'break-all',
    }}>
      {text}
    </div>
  )

  const copyBtn = (text: string, label = 'Copy') => (
    <button onClick={() => onCopy(text)} className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }}>
      {copied ? 'Copied!' : label}
    </button>
  )

  const doneBtn = (
    <button onClick={onClose} style={{ fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
      Done
    </button>
  )

  if (deploymentType === 'docker' || deploymentType === 'pi') {
    return (
      <>
        {tokenWarning}
        {deploymentType === 'pi' && (
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12, padding: '8px 12px', background: 'rgba(66,165,245,0.06)', borderRadius: 6, border: '1px solid rgba(66,165,245,0.12)' }}>
            Make sure Docker is installed on your Pi first:{' '}
            <code style={{ fontSize: 11 }}>curl -fsSL https://get.docker.com | sh</code>
          </p>
        )}
        {codeBlock(dockerCmd)}
        <div style={{ display: 'flex', gap: 12 }}>
          {copyBtn(dockerCmd, 'Copy command')}
          {doneBtn}
        </div>
      </>
    )
  }

  if (deploymentType === 'synology') {
    return (
      <>
        {tokenWarning}
        <ol style={{ fontSize: 12, color: '#94a3b8', lineHeight: 2, paddingLeft: 20, marginBottom: 16 }}>
          <li>Open <strong>Container Manager</strong> in DSM</li>
          <li>Go to <strong>Registry</strong> → search <code>ghcr.io/gjdbradford/sensor</code> → Download → latest</li>
          <li>Go to <strong>Container</strong> → Create → select the image</li>
          <li>Under <strong>Environment</strong>, add these three variables:</li>
        </ol>
        {codeBlock(`BREACHR_SENSOR_TOKEN  =  ${token}\nBREACHR_SENSOR_ID     =  ${sensorId}\nBREACHR_API_URL       =  ${apiUrl}`)}
        <ol start={5} style={{ fontSize: 12, color: '#94a3b8', lineHeight: 2, paddingLeft: 20, marginBottom: 16 }}>
          <li>Under <strong>Network</strong> → enable <strong>Use the same network as Docker Host</strong></li>
          <li>Under <strong>Capabilities</strong> → check <strong>NET_ADMIN</strong> and <strong>NET_RAW</strong></li>
          <li>Enable <strong>Auto-restart</strong> → Apply → Run</li>
        </ol>
        <div style={{ display: 'flex', gap: 12 }}>
          {copyBtn(`BREACHR_SENSOR_TOKEN=${token}\nBREACHR_SENSOR_ID=${sensorId}\nBREACHR_API_URL=${apiUrl}`, 'Copy env vars')}
          {doneBtn}
        </div>
      </>
    )
  }

  // native / systemd
  const installCmds = `# 1. Clone and install
sudo git clone https://github.com/gjdbradford/breachr-sensor /opt/breachr-sensor
cd /opt/breachr-sensor
sudo pip3 install -r requirements.txt

# 2. Save the systemd unit file
sudo nano /etc/systemd/system/breachr-sensor.service
# (paste the unit file content below, then save)

# 3. Enable and start
sudo systemctl daemon-reload
sudo systemctl enable breachr-sensor
sudo systemctl start breachr-sensor
sudo systemctl status breachr-sensor`

  return (
    <>
      {tokenWarning}
      <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        1. Install commands
      </p>
      {codeBlock(installCmds)}
      <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        2. systemd unit file — save to /etc/systemd/system/breachr-sensor.service
      </p>
      {codeBlock(systemdUnit)}
      <div style={{ display: 'flex', gap: 12 }}>
        {copyBtn(systemdUnit, 'Copy unit file')}
        {doneBtn}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify the modal renders without TypeScript errors**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/SensorRegistrationModal.tsx
git commit -m "feat: sensor deployment type picker with per-type setup instructions"
```

---

## Task 5: Deploy Portal to Production

- [ ] **Step 1: Deploy**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
vercel --prod
```

Then alias:
```bash
vercel alias <new-deployment-url> breachr-portal.vercel.app
```

- [ ] **Step 2: Smoke test**

1. Open https://breachr-portal.vercel.app → Sensors → Add Sensor
2. Confirm four deployment type cards appear
3. Select each type in turn — verify the card highlights
4. Fill in a name, register — confirm the correct setup instructions appear
5. Confirm "Copy" button copies the right content to clipboard

---

## Self-Review

**Spec coverage:**
- ✅ Raspberry Pi ARM: Task 1 (multi-arch build)
- ✅ Synology NAS: Task 4 (GUI instructions)
- ✅ Native Linux systemd: Task 4 (unit file + install commands)
- ✅ deployment_type stored in DB: Tasks 2 + 3
- ✅ Registration modal updated: Task 4

**Gaps / deferred:**
- Windows agent — deferred (requires full rewrite, see original plan)
- Virtual Appliance (OVA) — deferred
- Kubernetes DaemonSet — deferred
- `SensorTroubleshooting.tsx` — currently Docker-specific; a future task should filter/adapt troubleshooting steps by `deployment_type`

**Placeholder scan:** None found.

**Type consistency:** `DeploymentType = 'docker' | 'pi' | 'synology' | 'native'` used consistently across modal, route, and DB migration.
