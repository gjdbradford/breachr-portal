'use client'

import { useState } from 'react'
import type { DeploymentType } from '@/lib/sensor-types'

const issues = [
  {
    title: '--network host only works on Linux',
    severity: 'critical',
    body: (
      <>
        <p>This is the most common gotcha. <code>--network host</code> on Docker Desktop for Mac or Windows does <strong>not</strong> give the container access to the host&apos;s real network interface — it only works on a native Linux host (Ubuntu, Debian, Raspberry Pi, etc.).</p>
        <p style={{ marginTop: 8 }}>The machine running the sensor must be a Linux machine physically connected to the network you want to monitor.</p>
      </>
    ),
  },
  {
    title: 'Empty logs / no output from docker logs',
    severity: 'critical',
    body: (
      <>
        <p>Python buffers stdout when not running in a terminal, so nothing appears in <code>docker logs</code> unless <code>PYTHONUNBUFFERED=1</code> is set. Make sure you&apos;re pulling the latest image:</p>
        <pre>docker pull ghcr.io/gjdbradford/sensor:latest</pre>
        <p style={{ marginTop: 8 }}>Then re-run with the updated image.</p>
      </>
    ),
  },
  {
    title: 'Needs elevated privileges for packet capture',
    severity: 'high',
    body: (
      <>
        <p>Scapy captures raw ARP and DHCP packets which requires kernel-level network access. Add these flags to your <code>docker run</code> command:</p>
        <pre>--cap-add=NET_ADMIN --cap-add=NET_RAW</pre>
        <p style={{ marginTop: 8 }}>Or for quick testing, run fully privileged (less secure):</p>
        <pre>--privileged</pre>
      </>
    ),
  },
  {
    title: 'Outbound HTTPS (port 443) must be open',
    severity: 'high',
    body: (
      <>
        <p>The sensor sends heartbeats to <code>https://breachr-portal.vercel.app</code> over port 443. Corporate firewalls, proxy configurations, or restrictive egress rules will block this. Test from the sensor machine:</p>
        <pre>curl -I https://breachr-portal.vercel.app</pre>
        <p style={{ marginTop: 8 }}>If this fails, work with your network team to allow outbound HTTPS to Vercel.</p>
      </>
    ),
  },
  {
    title: 'Must be on the same broadcast domain (VLAN)',
    severity: 'high',
    body: (
      <p>The sensor only discovers devices on its own subnet. A sensor on <code>192.168.1.x</code> will not see devices on <code>10.0.0.x</code>. For multi-VLAN environments, deploy one sensor per VLAN, or configure managed switch port mirroring to aggregate traffic to a single sensor host.</p>
    ),
  },
  {
    title: 'DNS resolution failing',
    severity: 'medium',
    body: (
      <>
        <p>The sensor host must be able to resolve the portal domain. Test with:</p>
        <pre>nslookup breachr-portal.vercel.app</pre>
        <p style={{ marginTop: 8 }}>If this fails, check the machine&apos;s DNS configuration or add an explicit DNS server: <code>--dns 8.8.8.8</code> to the docker run command.</p>
      </>
    ),
  },
  {
    title: 'Container not surviving reboots',
    severity: 'medium',
    body: (
      <>
        <p>Without a restart policy, the sensor stops when the machine reboots. Add this flag to your <code>docker run</code> command:</p>
        <pre>--restart unless-stopped</pre>
      </>
    ),
  },
  {
    title: 'Token is one-time — 401 errors in logs',
    severity: 'medium',
    body: (
      <p>The token shown after sensor registration is only displayed once. If you see <code>401 Unauthorized</code> in the logs, the token was either lost, miscopied, or the container was recreated with a different one. Delete this sensor from the portal, register a new one, and use the fresh token.</p>
    ),
  },
  {
    title: 'Active scanning (nmap) blocked by firewalls',
    severity: 'low',
    body: (
      <>
        <p>The passive ARP/DHCP listener works without any special network permissions. The active nmap scanner sends probes that may be blocked by host-based firewalls on target devices, or trigger IDS/IPS alerts. To disable active scanning:</p>
        <pre>-e ACTIVE_SCAN=false</pre>
      </>
    ),
  },
  {
    title: 'Devices take a few minutes to appear',
    severity: 'low',
    body: (
      <p>The sensor sends a heartbeat on startup and every 60 seconds after that. A device must either broadcast an ARP or DHCP packet (which happens automatically when it joins the network or renews its lease), or be found by the active scanner. Allow 2–5 minutes after the sensor starts before expecting to see devices in Inventory.</p>
    ),
  },
]

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#22c55e',
}

const SEVERITY_BG: Record<string, string> = {
  critical: 'rgba(239,68,68,0.08)',
  high:     'rgba(249,115,22,0.08)',
  medium:   'rgba(245,158,11,0.08)',
  low:      'rgba(34,197,94,0.08)',
}

interface Props {
  selectedType?: DeploymentType
}

export default function SensorTroubleshooting({ selectedType }: Props) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div style={{ padding: '32px 24px 48px', maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 16, color: '#f59e0b' }}>⚠</span>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>TROUBLESHOOTING</p>
      </div>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
        If your sensor is running but not showing devices, or showing as offline, work through the issues below in order.
      </p>

      {/* Quick diagnostics */}
      <div style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 10, background: 'rgba(66,165,245,0.04)', border: '1px solid rgba(66,165,245,0.12)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#42a5f5', marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Quick diagnostic sequence</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['Is it running?',                      'docker ps'],
            ['Are logs showing?',                   'docker logs -f <container_id>'],
            ['Can it reach the portal?',            'docker exec <container_id> curl -I https://breachr-portal.vercel.app'],
            ['Can it resolve DNS?',                 'nslookup breachr-portal.vercel.app'],
          ].map(([label, cmd]) => (
            <div key={cmd} style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#64748b', minWidth: 220, flexShrink: 0 }}>{label}</span>
              <code style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>{cmd}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Full recommended run command */}
      <div style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recommended docker run flags</p>
        <pre style={{ fontSize: 11, color: '#64748b', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{`docker run -d \\
  --network host \\
  --restart unless-stopped \\
  --cap-add=NET_ADMIN --cap-add=NET_RAW \\
  -e BREACHR_SENSOR_TOKEN=<your_token> \\
  -e BREACHR_SENSOR_ID=<your_sensor_id> \\
  -e BREACHR_API_URL=https://breachr-portal.vercel.app \\
  ghcr.io/gjdbradford/sensor:latest`}</pre>
      </div>

      {/* Issues accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {issues.map((issue, i) => (
          <div key={i} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: '#0d1428' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <span style={{
                fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 3, flexShrink: 0,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                color: SEVERITY_COLOR[issue.severity],
                background: SEVERITY_BG[issue.severity],
                border: `1px solid ${SEVERITY_COLOR[issue.severity]}30`,
              }}>
                {issue.severity}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', flex: 1 }}>{issue.title}</span>
              <span style={{ fontSize: 14, color: '#42a5f5', flexShrink: 0, transform: open === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }}>+</span>
            </button>
            {open === i && (
              <div style={{ padding: '0 16px 14px', fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
                {issue.body}
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  )
}
