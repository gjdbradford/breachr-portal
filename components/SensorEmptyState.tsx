'use client'

import { useState } from 'react'
import { DEPLOYMENT_TYPES, type DeploymentType } from '@/lib/sensor-types'

interface Props {
  onAddSensor: (deploymentType: DeploymentType) => void
  selectedType: DeploymentType
  onTypeSelect: (type: DeploymentType) => void
}

const faqs = [
  {
    q: 'Will it slow down my network?',
    a: 'No. The sensor operates in passive mode by default — it only listens to broadcast traffic that already exists on your network (ARP, mDNS, DHCP). It never sends packets to discover devices, so there is zero latency impact on your users or systems. The optional active nmap scan runs every 4 hours against known IPs and uses rate-limited probes — typical overhead is under 1% of a 100Mbps link for a few minutes per scan.',
  },
  {
    q: 'What data does it send back, and is it encrypted?',
    a: 'The sensor sends only metadata: IP address, MAC address, hostname (if broadcast), vendor (from MAC prefix), OS hint (from DHCP fingerprint), and open port numbers with service names. It never captures packet payloads, usernames, passwords, or application data. All communication is outbound HTTPS (TLS 1.2+) to your Breachr portal — there are no inbound connections and no firewall holes required.',
  },
  {
    q: 'What network access does it need?',
    a: 'The sensor needs to be on the same broadcast domain as the devices you want to discover (the same VLAN or subnet). It requires outbound HTTPS access to your Breachr portal URL. It needs no inbound ports, no firewall exceptions, and no special router configuration. For best coverage, run it on the main LAN segment. For segmented networks, deploy one sensor per VLAN.',
  },
  {
    q: 'How is the sensor authenticated?',
    a: 'Each sensor is issued a unique bearer token when you register it in the portal. The token is bcrypt-hashed before storage — the plaintext is shown once and never stored. If a sensor token is compromised, you can disable the sensor from the portal and its token is immediately invalidated. All heartbeat requests are rejected without a valid token.',
  },
  {
    q: 'What happens if the sensor loses internet connectivity?',
    a: 'The sensor queues discovered assets locally and retries with exponential backoff. Data is not lost — it is buffered in memory and sent on the next successful connection. If the container restarts, it rebuilds its asset map from live network traffic within a few minutes.',
  },
  {
    q: 'Does it work on macOS or Windows?',
    a: 'The sensor runs on any platform that supports Docker. However, passive ARP sniffing requires --network host mode, which only works correctly on Linux. For production deployments, use a Linux host — a Raspberry Pi 4, a small VM, or an existing Linux server on the network all work well. macOS Docker Desktop uses a VM layer that prevents raw socket access.',
  },
  {
    q: 'Why do I need this for compliance?',
    a: 'DORA Article 8 requires a complete ICT asset inventory. NIS2 Article 21 requires you to know what is on your network and its security posture. PCI-DSS Requirement 12.5 mandates a system component inventory. Without automated discovery, these inventories go stale within days. The sensor keeps your inventory current automatically and flags new or unexpected devices.',
  },
]

const DOCKER_RUN_CMD = `docker run -d \\
  --name breachr-sensor \\
  --network host \\
  --restart unless-stopped \\
  --cap-add=NET_ADMIN \\
  --cap-add=NET_RAW \\
  -e BREACHR_TOKEN=<your-token> \\
  -e SENSOR_ID=<your-sensor-id> \\
  ghcr.io/gjdbradford/sensor:latest`

const PI_PREREQ_CMD = `curl -fsSL https://get.docker.com | sh`

const NATIVE_INSTALL_CMD = `git clone https://github.com/gjdbradford/sensor /opt/breachr-sensor
cd /opt/breachr-sensor
pip3 install -r requirements.txt`

const NATIVE_SYSTEMD_UNIT = `[Unit]
Description=Breachr Sensor
After=network.target

[Service]
User=root
WorkingDirectory=/opt/breachr-sensor
ExecStart=/usr/bin/python3 /opt/breachr-sensor/sensor.py
Environment=BREACHR_TOKEN=<your-token>
Environment=SENSOR_ID=<your-sensor-id>
Restart=on-failure

[Install]
WantedBy=multi-user.target`

const NATIVE_ENABLE_CMD = `sudo systemctl daemon-reload
sudo systemctl enable --now breachr-sensor`

function InstructionPanel({
  selectedType,
  onAddSensor,
}: {
  selectedType: DeploymentType
  onAddSensor: (type: DeploymentType) => void
}) {
  const [lastCopied, setLastCopied] = useState<string | null>(null)

  async function handleCopy(key: string, text: string) {
    await navigator.clipboard.writeText(text)
    setLastCopied(key)
    setTimeout(() => setLastCopied(null), 2000)
  }

  const codeBlock = (key: string, text: string) => (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <div style={{
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        padding: '12px 14px',
        paddingRight: 72,
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#94a3b8',
        whiteSpace: 'pre',
        overflowX: 'auto',
        lineHeight: 1.7,
      }}>
        {text}
      </div>
      <button
        onClick={() => handleCopy(key, text)}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          padding: '3px 10px',
          fontSize: 10,
          fontWeight: 600,
          background: lastCopied === key ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${lastCopied === key ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 4,
          color: lastCopied === key ? '#22c55e' : '#94a3b8',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {lastCopied === key ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )

  const sectionLabel = (text: string) => (
    <p style={{
      fontSize: 11,
      fontWeight: 700,
      color: '#475569',
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      marginBottom: 8,
      marginTop: 16,
    }}>
      {text}
    </p>
  )

  const renderContent = () => {
    if (selectedType === 'docker') {
      return (
        <>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, lineHeight: 1.6 }}>
            Run on any Linux host on the same subnet as the devices you want to discover.
          </p>
          {sectionLabel('Docker on Linux')}
          {codeBlock('docker-run', DOCKER_RUN_CMD)}
        </>
      )
    }

    if (selectedType === 'raspberry_pi') {
      return (
        <>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, lineHeight: 1.6 }}>
            A Raspberry Pi 3, 4, or 5 makes a great always-on sensor. Install Docker first, then run the container.
          </p>
          {sectionLabel('1. Install Docker')}
          {codeBlock('pi-prereq', PI_PREREQ_CMD)}
          {sectionLabel('2. Run the sensor')}
          {codeBlock('pi-docker-run', DOCKER_RUN_CMD)}
        </>
      )
    }

    if (selectedType === 'synology') {
      return (
        <>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16, lineHeight: 1.6 }}>
            Deploy via Container Manager in DSM 7+. No command line required.
          </p>
          <ol style={{ fontSize: 12, color: '#94a3b8', lineHeight: 2.1, paddingLeft: 20, margin: 0 }}>
            <li>Open <strong style={{ color: '#cbd5e1' }}>Container Manager</strong> → Registry → search <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>ghcr.io/gjdbradford/sensor</code></li>
            <li>Click <strong style={{ color: '#cbd5e1' }}>Download</strong> to pull the image</li>
            <li>Click <strong style={{ color: '#cbd5e1' }}>Create</strong> → give the container a name</li>
            <li>
              <strong style={{ color: '#cbd5e1' }}>Environment</strong> tab — add three variables:
              <ul style={{ marginTop: 4, marginBottom: 4, lineHeight: 2 }}>
                <li><code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>BREACHR_TOKEN</code> = <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>&lt;your-token&gt;</code></li>
                <li><code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>SENSOR_ID</code> = <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>&lt;your-sensor-id&gt;</code></li>
              </ul>
            </li>
            <li><strong style={{ color: '#cbd5e1' }}>Network</strong> → select <strong style={{ color: '#cbd5e1' }}>Host mode</strong></li>
            <li><strong style={{ color: '#cbd5e1' }}>Advanced Settings</strong> → Capabilities → enable <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>NET_ADMIN</code> and <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>NET_RAW</code></li>
            <li>Enable <strong style={{ color: '#cbd5e1' }}>Auto-restart</strong></li>
            <li>Click <strong style={{ color: '#cbd5e1' }}>Run</strong></li>
          </ol>
        </>
      )
    }

    // native
    return (
      <>
        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, lineHeight: 1.6 }}>
          Run the sensor as a systemd service — no Docker required.
        </p>
        {sectionLabel('1. Install')}
        {codeBlock('native-install', NATIVE_INSTALL_CMD)}
        {sectionLabel('2. systemd unit — save to /etc/systemd/system/breachr-sensor.service')}
        {codeBlock('native-systemd', NATIVE_SYSTEMD_UNIT)}
        {sectionLabel('3. Enable and start')}
        {codeBlock('native-enable', NATIVE_ENABLE_CMD)}
      </>
    )
  }

  return (
    <div style={{
      background: 'rgba(15,22,41,0.8)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: '24px 28px',
    }}>
      {renderContent()}

      {/* CTAs */}
      <div style={{
        marginTop: 24,
        paddingTop: 20,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap' as const,
      }}>
        <button
          onClick={() => onAddSensor(selectedType)}
          className="btn-p"
          style={{ fontSize: 13, padding: '10px 22px' }}
        >
          Register sensor to get your token →
        </button>
        <a
          href="#sensor-troubleshooting"
          style={{
            fontSize: 12,
            color: '#64748b',
            textDecoration: 'none',
            scrollBehavior: 'smooth',
          }}
          onClick={e => {
            e.preventDefault()
            document.querySelector('#sensor-troubleshooting')?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          Having trouble? See troubleshooting ↓
        </a>
      </div>
    </div>
  )
}

export default function SensorEmptyState({ onAddSensor, selectedType, onTypeSelect }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div style={{ padding: '0 24px 48px' }}>

      {/* Hero */}
      <div className="gs" style={{
        padding: '48px 40px',
        marginBottom: 24,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background grid decoration */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(25,118,210,0.06) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
        }} />

        {/* Network SVG diagram */}
        <div style={{ marginBottom: 32, position: 'relative' }}>
          <svg width="320" height="120" viewBox="0 0 320 120" fill="none" style={{ maxWidth: '100%' }}>
            {/* Lines */}
            <line x1="60" y1="60" x2="160" y2="60" stroke="rgba(25,118,210,0.4)" strokeWidth="1.5" strokeDasharray="4 3" />
            <line x1="160" y1="60" x2="260" y2="60" stroke="rgba(25,118,210,0.4)" strokeWidth="1.5" strokeDasharray="4 3" />
            <line x1="60" y1="60" x2="110" y2="20" stroke="rgba(25,118,210,0.2)" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="60" y1="60" x2="110" y2="100" stroke="rgba(25,118,210,0.2)" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="260" y1="60" x2="210" y2="20" stroke="rgba(25,118,210,0.2)" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="260" y1="60" x2="210" y2="100" stroke="rgba(25,118,210,0.2)" strokeWidth="1" strokeDasharray="3 3" />
            {/* Router */}
            <rect x="44" y="44" width="32" height="32" rx="4" fill="rgba(25,118,210,0.12)" stroke="rgba(25,118,210,0.4)" strokeWidth="1.5" />
            <text x="60" y="65" textAnchor="middle" fontSize="13" fill="#42a5f5">&#x2B21;</text>
            {/* Sensor — centre */}
            <circle cx="160" cy="60" r="18" fill="rgba(25,118,210,0.15)" stroke="#1976d2" strokeWidth="2" />
            <circle cx="160" cy="60" r="10" fill="rgba(25,118,210,0.3)" stroke="#42a5f5" strokeWidth="1" />
            <circle cx="160" cy="60" r="3" fill="#42a5f5" />
            {/* Devices */}
            <rect x="244" y="44" width="32" height="32" rx="4" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <text x="260" y="65" textAnchor="middle" fontSize="12" fill="#64748b">&#x2B1B;</text>
            <rect x="94" y="10" width="28" height="20" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <rect x="94" y="90" width="28" height="20" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <rect x="194" y="10" width="28" height="20" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <rect x="194" y="90" width="28" height="20" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            {/* Arrow to cloud */}
            <line x1="160" y1="42" x2="160" y2="10" stroke="rgba(34,197,94,0.5)" strokeWidth="1.5" markerEnd="url(#arr)" />
            <defs>
              <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="rgba(34,197,94,0.8)" />
              </marker>
            </defs>
            <text x="160" y="7" textAnchor="middle" fontSize="8" fill="rgba(34,197,94,0.7)">HTTPS</text>
          </svg>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 12, position: 'relative' }}>
          See every device on your network
        </h2>
        <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 520, margin: '0 auto 28px', lineHeight: 1.7, position: 'relative' }}>
          A Breachr sensor is a lightweight container that runs silently inside your network. It discovers every connected device, maps open ports, and checks them against known vulnerabilities — giving you a live, risk-scored asset inventory without touching a single device.
        </p>
        <button onClick={() => onAddSensor(selectedType)} className="btn-p" style={{ fontSize: 14, padding: '10px 28px', position: 'relative' }}>
          + Add your first sensor
        </button>
      </div>

      {/* Key properties */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          {
            icon: '◎',
            color: '#22c55e',
            title: 'Zero latency impact',
            body: 'Passive mode only — listens to existing broadcast traffic. Never sends probe packets. Your users and systems will not notice it is there.',
          },
          {
            icon: '⬡',
            color: '#42a5f5',
            title: 'One-way outbound only',
            body: 'The sensor only makes outbound HTTPS calls to your portal. No inbound ports, no firewall exceptions, no VPN required.',
          },
          {
            icon: '◈',
            color: '#f59e0b',
            title: 'No payload capture',
            body: 'Discovers devices by MAC address, IP, and hostname — never captures passwords, emails, or application data.',
          },
          {
            icon: '◉',
            color: '#a78bfa',
            title: 'Compliance-ready',
            body: 'Satisfies the asset inventory requirements of DORA Art. 8, NIS2 Art. 21, and PCI-DSS Req 12.5 automatically.',
          },
        ].map(card => (
          <div key={card.title} className="gs" style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: 18, color: card.color, marginBottom: 10 }}>{card.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{card.title}</div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{card.body}</div>
          </div>
        ))}
      </div>

      {/* Why it matters */}
      <div className="gs" style={{ padding: '28px 32px', marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 16, letterSpacing: '0.04em' }}>
          WHY YOU NEED TO KNOW WHAT&apos;S ON YOUR NETWORK
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {[
            {
              stat: '67%',
              label: 'of breaches involve an asset the organisation didn\'t know existed',
              sub: 'Shadow IT, forgotten servers, and IoT devices are the most common entry points.',
            },
            {
              stat: '19 days',
              label: 'average time to discover an unauthorised device on a network',
              sub: 'Manual audits go stale immediately. Automated discovery catches unknown devices within 60 seconds.',
            },
            {
              stat: '100%',
              label: 'of ICT asset inventory requirements under DORA, NIS2, and PCI-DSS',
              sub: 'Regulators require a current, accurate inventory — not a spreadsheet updated once a year.',
            },
          ].map(item => (
            <div key={item.stat} style={{ borderLeft: '2px solid rgba(25,118,210,0.3)', paddingLeft: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#42a5f5', lineHeight: 1 }}>{item.stat}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 1.5 }}>{item.label}</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 6, lineHeight: 1.5 }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Deployment type picker + inline instructions */}
      <div className="gs" style={{ padding: '28px 32px', marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 20, letterSpacing: '0.04em' }}>
          HOW TO DEPLOY — CHOOSE YOUR PLATFORM
        </h3>

        {/* 2x2 card grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {DEPLOYMENT_TYPES.map(dt => {
            const isSelected = selectedType === dt.id
            return (
              <button
                key={dt.id}
                onClick={() => onTypeSelect(dt.id)}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.15s',
                  outline: 'none',
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 6 }}>{dt.icon}</div>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isSelected ? '#a5b4fc' : '#cbd5e1',
                  marginBottom: 3,
                }}>
                  {dt.label}
                </div>
                <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>{dt.sub}</div>
              </button>
            )
          })}
        </div>

        {/* Inline instruction panel */}
        <InstructionPanel selectedType={selectedType} onAddSensor={onAddSensor} />
      </div>

      {/* FAQs / Troubleshooting */}
      <div id="sensor-troubleshooting" className="gs" style={{ padding: '28px 32px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 20, letterSpacing: '0.04em' }}>
          FREQUENTLY ASKED QUESTIONS
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '16px 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                }}
              >
                <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{faq.q}</span>
                <span style={{
                  fontSize: 16, color: '#42a5f5', flexShrink: 0,
                  transform: openFaq === i ? 'rotate(45deg)' : 'none',
                  transition: 'transform 0.2s',
                }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{
                  fontSize: 12, color: '#94a3b8', lineHeight: 1.7,
                  paddingBottom: 16,
                }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
