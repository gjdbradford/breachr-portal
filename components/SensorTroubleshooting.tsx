'use client'

import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { DeploymentType } from '@/lib/sensor-types'

interface Issue {
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  types: DeploymentType[]
  body: ReactNode
}

const issues: Issue[] = [
  {
    title: '--network host only works on Linux',
    severity: 'critical',
    types: ['docker', 'raspberry_pi'],
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
    types: ['docker', 'raspberry_pi'],
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
    types: ['docker', 'raspberry_pi'],
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
    types: ['docker', 'raspberry_pi', 'synology', 'native'],
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
    types: ['docker', 'raspberry_pi', 'synology', 'native'],
    body: (
      <p>The sensor only discovers devices on its own subnet. A sensor on <code>192.168.1.x</code> will not see devices on <code>10.0.0.x</code>. For multi-VLAN environments, deploy one sensor per VLAN, or configure managed switch port mirroring to aggregate traffic to a single sensor host.</p>
    ),
  },
  {
    title: 'DNS resolution failing',
    severity: 'medium',
    types: ['docker', 'raspberry_pi', 'synology', 'native'],
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
    types: ['docker', 'raspberry_pi'],
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
    types: ['docker', 'raspberry_pi', 'synology', 'native'],
    body: (
      <p>The token shown after sensor registration is only displayed once. If you see <code>401 Unauthorized</code> in the logs, the token was either lost, miscopied, or the container was recreated with a different one. Delete this sensor from the portal, register a new one, and use the fresh token.</p>
    ),
  },
  {
    title: 'Active scanning (nmap) blocked by firewalls',
    severity: 'low',
    types: ['docker', 'raspberry_pi', 'synology', 'native'],
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
    types: ['docker', 'raspberry_pi', 'synology', 'native'],
    body: (
      <p>The sensor sends a heartbeat on startup and every 60 seconds after that. A device must either broadcast an ARP or DHCP packet (which happens automatically when it joins the network or renews its lease), or be found by the active scanner. Allow 2–5 minutes after the sensor starts before expecting to see devices in Inventory.</p>
    ),
  },

  // Raspberry Pi issues
  {
    title: 'Docker not installed on Pi',
    severity: 'critical',
    types: ['raspberry_pi'],
    body: (
      <>
        <p>Raspberry Pi OS does not include Docker by default. Install it with the official convenience script:</p>
        <pre>curl -fsSL https://get.docker.com | sh</pre>
        <p style={{ marginTop: 8 }}>After installation, add your user to the docker group so you can run docker without sudo:</p>
        <pre>sudo usermod -aG docker $USER</pre>
        <p style={{ marginTop: 8 }}>Log out and back in for the group change to take effect.</p>
      </>
    ),
  },
  {
    title: '32-bit OS — wrong image architecture',
    severity: 'high',
    types: ['raspberry_pi'],
    body: (
      <p>The sensor image is built for <code>arm64</code> (64-bit ARM). If you are running 32-bit Raspberry Pi OS (<code>armhf</code>), the container will fail to start. Check your OS architecture with <code>uname -m</code> — it must show <code>aarch64</code>. Download the 64-bit version of Raspberry Pi OS from the official imager.</p>
    ),
  },
  {
    title: 'Viewing logs on a headless Pi',
    severity: 'medium',
    types: ['raspberry_pi'],
    body: (
      <>
        <p>If you&apos;re accessing the Pi over SSH, view live sensor logs with:</p>
        <pre>docker logs -f breachr-sensor</pre>
        <p style={{ marginTop: 8 }}>To view the last 100 lines without following:</p>
        <pre>docker logs --tail 100 breachr-sensor</pre>
      </>
    ),
  },

  // Synology NAS issues
  {
    title: 'Image not found — ghcr.io requires manual registry URL',
    severity: 'critical',
    types: ['synology'],
    body: (
      <>
        <p>Container Manager does not include GitHub Container Registry by default. You must add it manually:</p>
        <p style={{ marginTop: 8 }}>Container Manager → Registry → Settings → Add → enter URL: <code>ghcr.io</code></p>
        <p style={{ marginTop: 8 }}>Then search for <code>gjdbradford/sensor</code> in the Registry tab.</p>
      </>
    ),
  },
  {
    title: 'Container exits immediately — missing or mistyped environment variables',
    severity: 'critical',
    types: ['synology'],
    body: (
      <>
        <p>Almost always caused by missing or mistyped environment variables. In the container settings, open the <strong>Environment</strong> tab and verify all three are set exactly:</p>
        <pre>{'BREACHR_SENSOR_TOKEN\nBREACHR_SENSOR_ID\nBREACHR_API_URL'}</pre>
        <p style={{ marginTop: 8 }}>The token must not have extra spaces. The API URL must be <code>https://breachr-portal.vercel.app</code> (include <code>https://</code>).</p>
      </>
    ),
  },
  {
    title: 'Host network option missing — requires DSM 7.2+',
    severity: 'high',
    types: ['synology'],
    body: (
      <p>Host network mode is only available in Container Manager on DSM 7.2 and later. If the Network tab does not show a "Host" option, update DSM via Control Panel → Update &amp; Restore. DSM 7.1 and earlier do not support host networking in Container Manager.</p>
    ),
  },
  {
    title: 'NET_ADMIN / NET_RAW not available in Capabilities tab',
    severity: 'high',
    types: ['synology'],
    body: (
      <p>Some Synology NAS models with older kernels do not expose <code>NET_ADMIN</code> and <code>NET_RAW</code> capabilities to containers. If these options are absent in the Advanced Settings → Capabilities tab, the sensor will not be able to capture packets. This is a hardware/kernel limitation and cannot be worked around on those models.</p>
    ),
  },
  {
    title: 'Auto-restart not working after NAS reboot',
    severity: 'medium',
    types: ['synology'],
    body: (
      <>
        <p>If the container does not start automatically after a NAS reboot, check that Auto-restart is enabled in the container settings (Advanced Settings → Auto-restart) and that the container is in <strong>running</strong> state before rebooting — not just created.</p>
        <p style={{ marginTop: 8 }}>You can also verify by checking the container&apos;s log after reboot: Container Manager → Containers → breachr-sensor → Logs.</p>
      </>
    ),
  },

  // Native Linux issues
  {
    title: 'pip3 not found',
    severity: 'critical',
    types: ['native'],
    body: (
      <>
        <p>Python 3 pip is not installed by default on all Linux distributions. Install it with:</p>
        <pre>sudo apt install python3-pip</pre>
        <p style={{ marginTop: 8 }}>On RHEL/CentOS/Fedora:</p>
        <pre>sudo dnf install python3-pip</pre>
      </>
    ),
  },
  {
    title: 'Service fails — WorkingDirectory not found',
    severity: 'critical',
    types: ['native'],
    body: (
      <p>The systemd unit file has <code>WorkingDirectory=/opt/breachr-sensor</code>. This path must match exactly where you cloned the repository. If you cloned to a different location, edit <code>/etc/systemd/system/breachr-sensor.service</code> and update both <code>WorkingDirectory</code> and <code>ExecStart</code> to match. Run <code>sudo systemctl daemon-reload</code> after editing.</p>
    ),
  },
  {
    title: 'Scapy permission error — service must run as root',
    severity: 'high',
    types: ['native'],
    body: (
      <>
        <p>The sensor uses Scapy for packet capture, which requires root privileges. The systemd unit must include <code>User=root</code>:</p>
        <pre>{'[Service]\nUser=root'}</pre>
        <p style={{ marginTop: 8 }}>If you see <code>Operation not permitted</code> in the logs, this line is missing or set to a non-root user.</p>
      </>
    ),
  },
  {
    title: 'Service starts but no devices appear — Python environment issue',
    severity: 'high',
    types: ['native'],
    body: (
      <>
        <p>If you installed dependencies into a virtual environment, the systemd unit&apos;s <code>ExecStart</code> must point to the venv Python, not the system Python:</p>
        <pre>ExecStart=/opt/breachr-sensor/venv/bin/python sensor.py</pre>
        <p style={{ marginTop: 8 }}>Also verify that <code>BREACHR_API_URL</code> is set in the unit file&apos;s <code>Environment=</code> lines and that outbound HTTPS is allowed from the host.</p>
      </>
    ),
  },
  {
    title: 'How to view live logs',
    severity: 'medium',
    types: ['native'],
    body: (
      <>
        <p>View live sensor logs with journalctl:</p>
        <pre>sudo journalctl -f -u breachr-sensor</pre>
        <p style={{ marginTop: 8 }}>To view the last 100 lines without following:</p>
        <pre>sudo journalctl -n 100 -u breachr-sensor</pre>
      </>
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

const DOCKER_DIAGNOSTICS: [string, string][] = [
  ['Is it running?',           'docker ps'],
  ['Are logs showing?',        'docker logs -f <container_id>'],
  ['Can it reach the portal?', 'docker exec <container_id> curl -I https://breachr-portal.vercel.app'],
  ['Can it resolve DNS?',      'nslookup breachr-portal.vercel.app'],
]

const SYNOLOGY_DIAGNOSTICS: [string, string][] = [
  ['Is the container running?', 'Container Manager → Containers → check Status'],
  ['Container logs',            'Container Manager → Containers → breachr-sensor → Logs'],
  ['Can it reach the portal?',  'from NAS shell: curl -I https://breachr-portal.vercel.app'],
]

const NATIVE_DIAGNOSTICS: [string, string][] = [
  ['Is the service running?', 'sudo systemctl status breachr-sensor'],
  ['View live logs',          'sudo journalctl -f -u breachr-sensor'],
  ['Can it reach the portal?', 'curl -I https://breachr-portal.vercel.app'],
]

interface Props {
  selectedType?: DeploymentType
  onOpenChat?: () => void
}

export default function SensorTroubleshooting({ selectedType, onOpenChat }: Props) {
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => { setOpen(null) }, [selectedType])

  const visibleIssues = selectedType
    ? issues.filter(issue => issue.types.includes(selectedType))
    : issues

  const showDockerSection = !selectedType || selectedType === 'docker' || selectedType === 'raspberry_pi'
  const showSynologySection = selectedType === 'synology'
  const showNativeSection = selectedType === 'native'

  const diagnostics =
    showSynologySection ? SYNOLOGY_DIAGNOSTICS :
    showNativeSection   ? NATIVE_DIAGNOSTICS :
    DOCKER_DIAGNOSTICS

  return (
    <div id="sensor-troubleshooting" style={{ padding: '32px 24px 48px', maxWidth: 860, margin: '0 auto' }}>

      {/* AI assistant banner */}
      {onOpenChat && (
        <div
          onClick={onOpenChat}
          style={{
            marginBottom: 20,
            padding: '14px 20px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
        >
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#a5b4fc', margin: 0 }}>
              Still stuck? Ask the Breachr AI assistant
            </p>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
              Only answers questions about sensor setup and troubleshooting
            </p>
          </div>
          <span style={{ fontSize: 20, color: '#818cf8', flexShrink: 0, marginLeft: 12 }}>→</span>
        </div>
      )}

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
          {diagnostics.map(([label, cmd]) => (
            <div key={cmd} style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#64748b', minWidth: 220, flexShrink: 0 }}>{label}</span>
              <code style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>{cmd}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Full recommended run command — Docker and Raspberry Pi only */}
      {showDockerSection && (
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
      )}

      {/* Issues accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {visibleIssues.map((issue) => (
          <div key={issue.title} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: '#0d1428' }}>
            <button
              onClick={() => setOpen(open === issue.title ? null : issue.title)}
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
              <span style={{ fontSize: 14, color: '#42a5f5', flexShrink: 0, transform: open === issue.title ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }}>+</span>
            </button>
            {open === issue.title && (
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
