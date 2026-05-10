'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatFriendly } from '@/lib/format-date'
import { DEPLOYMENT_TYPES, type DeploymentType } from '@/lib/sensor-types'
import SensorTroubleshooting from './SensorTroubleshooting'

interface Sensor {
  id: string
  name: string
  location: string | null
  last_seen: string | null
  status: string
  deployment_type: string
}

interface SensorLog {
  id: number
  event_type: string
  message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

const PAGE_SIZE = 100

const EVENT_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  assets_discovered: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.2)'    },
  heartbeat:         { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.2)'    },
  activated:         { color: '#42a5f5', bg: 'rgba(66,165,245,0.1)',    border: 'rgba(66,165,245,0.25)'  },
  deactivated:       { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',    border: 'rgba(245,158,11,0.25)'  },
  token_regenerated: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',   border: 'rgba(167,139,250,0.25)' },
  updated:           { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)',  border: 'rgba(148,163,184,0.2)'  },
  created:           { color: '#818cf8', bg: 'rgba(129,140,248,0.1)',   border: 'rgba(129,140,248,0.25)' },
}

function InstallInstructions({
  sensorId,
  deploymentType: initialType,
}: {
  sensorId: string
  deploymentType: DeploymentType
}) {
  const [open, setOpen]             = useState(false)
  const [token, setToken]           = useState<string | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [cmdCopied, setCmdCopied]   = useState<string | null>(null)
  const [confirm, setConfirm]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const apiUrl                      = typeof window !== 'undefined' ? window.location.origin : ''

  async function generateToken() {
    setLoading(true)
    try {
      const res = await fetch(`/api/sensors/${sensorId}/regenerate-token`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setToken(data.token)
        setConfirm(false)
      }
    } finally {
      setLoading(false)
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      if (key === 'token') { setTokenCopied(true); setTimeout(() => setTokenCopied(false), 2000) }
      else { setCmdCopied(key); setTimeout(() => setCmdCopied(null), 2000) }
    })
  }

  const dockerCmd = token
    ? `docker run -d --network host \\\n  --restart unless-stopped \\\n  --cap-add=NET_ADMIN --cap-add=NET_RAW \\\n  -e BREACHR_SENSOR_TOKEN=${token} \\\n  -e BREACHR_SENSOR_ID=${sensorId} \\\n  -e BREACHR_API_URL=${apiUrl} \\\n  ghcr.io/gjdbradford/sensor:latest`
    : ''

  const systemdUnit = token
    ? `[Unit]
Description=Breachr Network Sensor
After=network.target

[Service]
Type=simple
User=root
Environment=BREACHR_SENSOR_TOKEN=${token}
Environment=BREACHR_SENSOR_ID=${sensorId}
Environment=BREACHR_API_URL=${apiUrl}
WorkingDirectory=/opt/breachr-sensor
ExecStart=/usr/bin/python3 main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target`
    : ''

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

  function codeBlock(text: string) {
    return (
      <div style={{
        background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 14, marginBottom: 10,
        fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', whiteSpace: 'pre-wrap',
        border: '1px solid rgba(255,255,255,0.08)', wordBreak: 'break-all',
      }}>{text}</div>
    )
  }

  function copyBtn(text: string, key: string, label: string) {
    return (
      <button onClick={() => copy(text, key)} style={{
        fontSize: 12, padding: '5px 14px', borderRadius: 5, cursor: 'pointer',
        background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)',
        color: cmdCopied === key ? '#22c55e' : '#818cf8', fontWeight: 600,
      }}>
        {cmdCopied === key ? '✓ Copied' : label}
      </button>
    )
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Rotate token</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
            Reinstall this sensor on the same machine with a fresh token.
          </div>
        </div>
        <span style={{ fontSize: 16, color: '#475569', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>⌄</span>
      </button>

      {open && (
        <div style={{ padding: '0 24px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

          {/* Step 1: Generate token */}
          {!token ? (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!confirm ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Rotating the token will invalidate the current one.</div>
                      <div style={{ fontSize: 12, color: '#475569' }}>Once rotated, you&apos;ll get a new token and updated install commands. You&apos;ll need to update the sensor on its current device to keep it reporting.</div>
                    </div>
                    <button
                      onClick={() => setConfirm(true)}
                      style={{ fontSize: 12, padding: '8px 18px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', fontWeight: 600 }}
                    >
                      Rotate token
                    </button>
                  </div>
                  <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontSize: 12, color: '#475569' }}>
                      Want to install this sensor on a <strong style={{ color: '#64748b' }}>different machine</strong>? We recommend registering a new sensor instead — each machine should have its own.
                    </div>
                    <Link
                      href="/dashboard/sensors?new=1"
                      style={{ fontSize: 12, padding: '6px 14px', borderRadius: 5, whiteSpace: 'nowrap', textDecoration: 'none', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}
                    >
                      Create new sensor →
                    </Link>
                  </div>
                </>
              ) : (
                <div style={{ padding: '14px 16px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8 }}>
                  <p style={{ fontSize: 13, color: '#fcd34d', marginBottom: 4, fontWeight: 600 }}>Are you sure you want to rotate the token?</p>
                  <p style={{ fontSize: 12, color: '#92400e', marginBottom: 14 }}>
                    The existing token will be deprecated immediately. Your sensor will stop reporting until you update it with the new token on the device it&apos;s running on.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={generateToken} disabled={loading}
                      style={{ fontSize: 12, padding: '6px 16px', borderRadius: 5, cursor: 'pointer', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', fontWeight: 600 }}
                    >
                      {loading ? 'Rotating…' : 'Yes, rotate token'}
                    </button>
                    <button onClick={() => setConfirm(false)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 5, cursor: 'pointer', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#475569' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 20 }}>
              {/* Token display */}
              <div style={{ padding: '14px 16px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: '#22c55e', marginBottom: 10, fontWeight: 600 }}>
                  New token generated — copy it now, it won&apos;t be shown again.
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <code style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', color: '#e2e8f0', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', wordBreak: 'break-all' }}>
                    {token}
                  </code>
                  <button onClick={() => copy(token, 'token')} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 5, cursor: 'pointer', background: tokenCopied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: tokenCopied ? '#22c55e' : '#94a3b8', whiteSpace: 'nowrap' }}>
                    {tokenCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Commands */}
              {(initialType === 'docker' || initialType === 'raspberry_pi') ? (
                <>
                  {initialType === 'raspberry_pi' && (
                    <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12, padding: '8px 12px', background: 'rgba(66,165,245,0.06)', borderRadius: 6, border: '1px solid rgba(66,165,245,0.12)' }}>
                      Make sure Docker is installed first: <code style={{ fontSize: 11 }}>curl -fsSL https://get.docker.com | sh</code>
                    </p>
                  )}
                  {codeBlock(dockerCmd)}
                  {copyBtn(dockerCmd, 'docker', 'Copy command')}
                </>
              ) : initialType === 'synology' ? (
                <>
                  <ol style={{ fontSize: 12, color: '#94a3b8', lineHeight: 2, paddingLeft: 20, marginBottom: 12 }}>
                    <li>Open <strong>Container Manager</strong> in DSM</li>
                    <li>Go to <strong>Registry</strong> → search <code>ghcr.io/gjdbradford/sensor</code> → Download → latest</li>
                    <li>Go to <strong>Container</strong> → Create → select the image</li>
                    <li>Under <strong>Environment</strong>, add these three variables:</li>
                  </ol>
                  {codeBlock(`BREACHR_SENSOR_TOKEN  =  ${token}\nBREACHR_SENSOR_ID     =  ${sensorId}\nBREACHR_API_URL       =  ${apiUrl}`)}
                  {copyBtn(`BREACHR_SENSOR_TOKEN=${token}\nBREACHR_SENSOR_ID=${sensorId}\nBREACHR_API_URL=${apiUrl}`, 'synology', 'Copy env vars')}
                  <ol start={5} style={{ fontSize: 12, color: '#94a3b8', lineHeight: 2, paddingLeft: 20, marginTop: 12 }}>
                    <li>Under <strong>Network</strong> → enable <strong>Use the same network as Docker Host</strong></li>
                    <li>Under <strong>Capabilities</strong> → check <strong>NET_ADMIN</strong> and <strong>NET_RAW</strong></li>
                    <li>Enable <strong>Auto-restart</strong> → Apply → Run</li>
                  </ol>
                </>
              ) : (
                <>
                  {codeBlock(installCmds)}
                  {copyBtn(installCmds, 'install', 'Copy install commands')}
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '16px 0 8px' }}>
                    systemd unit file — save to /etc/systemd/system/breachr-sensor.service
                  </p>
                  {codeBlock(systemdUnit)}
                  {copyBtn(systemdUnit, 'systemd', 'Copy unit file')}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function isActive(lastSeen: string | null) {
  if (!lastSeen) return false
  return new Date(lastSeen) > new Date(Date.now() - 5 * 60 * 1000)
}

export default function SensorDetail({
  sensor: initial,
  canManage,
  timezone,
}: {
  sensor: Sensor
  canManage: boolean
  timezone: string
}) {
  const router = useRouter()
  const [sensor, setSensor]     = useState(initial)
  const [logsOpen, setLogsOpen]       = useState(false)
  const [logs, setLogs]               = useState<SensorLog[]>([])
  const [logTotal, setLogTotal]       = useState(0)
  const [logPage, setLogPage]         = useState(1)
  const [logsLoading, setLogsLoading] = useState(false)

  // Edit state
  const [editing, setEditing]       = useState(false)
  const [editName, setEditName]     = useState(initial.name)
  const [editLoc, setEditLoc]       = useState(initial.location ?? '')
  const [saving, setSaving]         = useState(false)

  // Activate/deactivate
  const [toggleLoading, setToggleLoading] = useState(false)

  const fetchLogs = useCallback(async (page: number) => {
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/sensors/${sensor.id}/logs?p=${page}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setLogTotal(data.total)
      }
    } finally {
      setLogsLoading(false)
    }
  }, [sensor.id])

  useEffect(() => { if (logsOpen) fetchLogs(logPage) }, [logsOpen, fetchLogs, logPage])

  async function saveEdit() {
    setSaving(true)
    try {
      const res = await fetch(`/api/sensors/${sensor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, location: editLoc }),
      })
      if (res.ok) {
        setSensor(s => ({ ...s, name: editName.trim(), location: editLoc.trim() || null }))
        setEditing(false)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActivate() {
    setToggleLoading(true)
    try {
      const activate = sensor.status === 'disabled'
      const res = await fetch(`/api/sensors/${sensor.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: activate }),
      })
      if (res.ok) {
        const data = await res.json()
        setSensor(s => ({ ...s, status: data.status }))
        fetchLogs(1)
        setLogPage(1)
      }
    } finally {
      setToggleLoading(false)
    }
  }

  const totalLogPages = Math.ceil(logTotal / PAGE_SIZE)
  const active = isActive(sensor.last_seen)
  const disabled = sensor.status === 'disabled'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link href="/dashboard/sensors" style={{ fontSize: 12, color: '#475569', textDecoration: 'none' }}>
              ← Sensors
            </Link>
          </div>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                style={{
                  fontSize: 18, fontWeight: 700, color: '#e2e8f0',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(99,102,241,0.5)',
                  borderRadius: 6, padding: '6px 12px', outline: 'none', width: 320,
                }}
              />
              <input
                value={editLoc}
                onChange={e => setEditLoc(e.target.value)}
                placeholder="Location (optional)"
                style={{
                  fontSize: 13, color: '#94a3b8',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6, padding: '5px 12px', outline: 'none', width: 320,
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={saveEdit} disabled={saving || !editName.trim()}
                  style={{
                    fontSize: 12, padding: '5px 16px', borderRadius: 5, cursor: 'pointer',
                    background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.5)',
                    color: '#818cf8', fontWeight: 600,
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditName(sensor.name); setEditLoc(sensor.location ?? '') }}
                  style={{ fontSize: 12, padding: '5px 12px', borderRadius: 5, cursor: 'pointer', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#475569' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em', marginBottom: 4 }}>
                {sensor.name}
              </h1>
              {sensor.location && (
                <p style={{ fontSize: 13, color: '#64748b' }}>{sensor.location}</p>
              )}
            </>
          )}
        </div>

        {/* Status + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
            background: disabled ? 'rgba(100,116,139,0.1)' : active ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
            color: disabled ? '#475569' : active ? '#22c55e' : '#f59e0b',
            border: `1px solid ${disabled ? 'rgba(100,116,139,0.2)' : active ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
          }}>
            {disabled ? 'Disabled' : active ? 'Active' : 'Offline'}
          </span>

          {canManage && !editing && (
            <button
              onClick={() => setEditing(true)}
              style={{ fontSize: 12, padding: '5px 14px', borderRadius: 5, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
            >
              Edit
            </button>
          )}

          {canManage && (
            <button
              onClick={toggleActivate} disabled={toggleLoading}
              style={{
                fontSize: 12, padding: '5px 14px', borderRadius: 5, cursor: 'pointer',
                background: disabled ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${disabled ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: disabled ? '#22c55e' : '#ef4444',
              }}
            >
              {toggleLoading ? '…' : disabled ? 'Enable' : 'Disable'}
            </button>
          )}
        </div>
      </div>

      {/* Info cards */}
      {(() => {
        const dtLabel = DEPLOYMENT_TYPES.find(d => d.id === sensor.deployment_type)?.label ?? sensor.deployment_type
        const statusLabel = disabled ? 'Disabled' : active ? 'Active' : 'Offline'
        const statusColor = disabled ? '#ef4444' : active ? '#22c55e' : '#f59e0b'
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { label: 'Deployment type', value: dtLabel },
              { label: 'Last seen', value: sensor.last_seen ? formatFriendly(sensor.last_seen, timezone) : 'Never' },
              { label: 'Status', value: statusLabel, color: statusColor },
              { label: 'Sensor ID', value: sensor.id.slice(0, 8) + '…', mono: true },
            ].map(({ label, value, mono, color }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>{label.toUpperCase()}</div>
                <div style={{ fontSize: 13, color: color ?? '#e2e8f0', fontFamily: mono ? 'monospace' : undefined }}>{value}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Installation instructions */}
      {canManage && (
        <InstallInstructions
          sensorId={sensor.id}
          deploymentType={sensor.deployment_type as DeploymentType}
        />
      )}

      {/* Troubleshooting */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <TroubleshootingToggle deploymentType={sensor.deployment_type as DeploymentType} />
      </div>

      {/* Activity log — lazy loaded */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', cursor: 'pointer' }}
          onClick={() => setLogsOpen(o => !o)}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
              Activity log
              {logTotal > 0 && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: '#475569' }}>{logTotal.toLocaleString()} events</span>}
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>State changes, token rotations, and asset discoveries</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {canManage && logsOpen && (
              <a
                href={`/api/sensors/${sensor.id}/logs/export`}
                onClick={e => e.stopPropagation()}
                style={{ fontSize: 12, padding: '4px 12px', borderRadius: 5, textDecoration: 'none', background: 'rgba(25,118,210,0.1)', border: '1px solid rgba(25,118,210,0.25)', color: '#42a5f5' }}
              >
                ↓ Export
              </a>
            )}
            <span style={{ fontSize: 16, color: '#475569', transform: logsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>⌄</span>
          </div>
        </div>

        {logsOpen && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px 24px' }}>
            {logsLoading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#475569', fontSize: 13 }}>Loading…</div>
            ) : logs.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#475569', fontSize: 13 }}>No activity yet</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Event</th><th>Message</th><th>Metadata</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const style = EVENT_STYLES[log.event_type] ?? EVENT_STYLES.updated
                    return (
                      <tr key={log.id}>
                        <td>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: style.bg, color: style.color, border: `1px solid ${style.border}`, whiteSpace: 'nowrap' }}>
                            {log.event_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: '#94a3b8' }}>{log.message ?? '—'}</td>
                        <td style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.metadata ? JSON.stringify(log.metadata) : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                          {formatFriendly(log.created_at, timezone)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {totalLogPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#475569' }}>
                  Showing {((logPage - 1) * PAGE_SIZE) + 1}–{Math.min(logPage * PAGE_SIZE, logTotal)} of {logTotal} event{logTotal !== 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setLogPage(p => p - 1)} disabled={logPage === 1}
                    style={{ padding: '5px 10px', borderRadius: 4, fontSize: 12, cursor: logPage === 1 ? 'not-allowed' : 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: logPage === 1 ? '#334155' : '#94a3b8' }}>←</button>
                  {Array.from({ length: totalLogPages }, (_, i) => i + 1)
                    .filter(n => n === 1 || n === totalLogPages || Math.abs(n - logPage) <= 2)
                    .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                      if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…')
                      acc.push(n)
                      return acc
                    }, [])
                    .map((n, i) => n === '…'
                      ? <span key={`e-${i}`} style={{ padding: '5px 6px', color: '#475569', fontSize: 12 }}>…</span>
                      : <button key={n} onClick={() => setLogPage(n as number)} style={{ padding: '5px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer', background: n === logPage ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${n === logPage ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`, color: n === logPage ? '#818cf8' : '#94a3b8', fontWeight: n === logPage ? 700 : 400 }}>{n}</button>
                    )}
                  <button onClick={() => setLogPage(p => p + 1)} disabled={logPage === totalLogPages}
                    style={{ padding: '5px 10px', borderRadius: 4, fontSize: 12, cursor: logPage === totalLogPages ? 'not-allowed' : 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: logPage === totalLogPages ? '#334155' : '#94a3b8' }}>→</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TroubleshootingToggle({ deploymentType }: { deploymentType: DeploymentType }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Troubleshooting this sensor</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
            Common issues and diagnostics for {DEPLOYMENT_TYPES.find(d => d.id === deploymentType)?.label ?? deploymentType}
          </div>
        </div>
        <span style={{ fontSize: 16, color: '#475569', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>⌄</span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <SensorTroubleshooting selectedType={deploymentType} />
        </div>
      )}
    </>
  )
}
