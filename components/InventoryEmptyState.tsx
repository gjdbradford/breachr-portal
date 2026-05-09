'use client'

import { useState } from 'react'
import Link from 'next/link'

const faqs = [
  {
    q: 'What does the risk score mean?',
    a: 'Each device is scored 0–100 based on CVE matches found against its OS and open services. A critical CVE adds 40 points, high adds 20, medium adds 10 — capped at 100. A score of 0 means no CVEs matched, not that the device is safe. Devices with many open ports and no CVE matches are still worth reviewing manually.',
  },
  {
    q: 'How do I identify unknown devices?',
    a: 'Click any device in the inventory list to open its detail page. You\'ll see the MAC address (which encodes the manufacturer), open ports and service banners, and any hostname broadcast over DHCP or mDNS. For truly unknown devices, the MAC vendor lookup and open ports usually reveal the device type — e.g. a device with port 80 open and a Cisco MAC is likely a managed switch. You can update the hostname directly from the detail page.',
  },
  {
    q: 'How current are the CVE matches?',
    a: 'CVE data is fetched from the NIST NVD 2.0 API every night at 02:00 UTC and matched against your assets. You can also trigger a manual refresh at any time from the Breachr API. New vulnerabilities published today will appear in your inventory tomorrow morning. The match is based on OS type and service names — it is keyword-based rather than package-level, so some false positives are possible.',
  },
  {
    q: 'What counts as a risky open port?',
    a: 'Any service exposed that should not be. Common high-risk findings: Telnet (23) or FTP (21) instead of SSH, RDP (3389) exposed on non-server machines, database ports (3306, 5432, 27017) visible outside a server segment, UPnP (1900) on network infrastructure. The active scanner finds these during the 4-hourly nmap sweep and they appear in the Open Ports table on each asset\'s detail page.',
  },
  {
    q: 'Can I remove a stale device from inventory?',
    a: 'Devices are automatically marked Offline after 24 hours without a heartbeat from the sensor. They remain in the list (greyed out) so you have a record. If a device has left the network permanently, you can delete it from the asset detail page. The sensor will not re-add it unless the device reappears on the network.',
  },
  {
    q: 'How do I monitor for new or unexpected devices?',
    a: 'Any device that connects to your network and broadcasts ARP will be discovered within 60 seconds of the next sensor heartbeat. Newly discovered devices appear at the top of the inventory list (sorted by first-seen if you filter by recent). Future versions of Breachr will send alerts when unexpected new devices appear — for now, review the inventory list regularly and look for devices with unknown hostnames or vendors.',
  },
  {
    q: 'Does it work on VLANs and segmented networks?',
    a: 'The sensor only discovers devices on the same broadcast domain (subnet/VLAN) as the host it runs on. For segmented networks, deploy one sensor per VLAN. Each sensor appears separately in this portal and its assets are grouped accordingly. The inventory list shows all assets across all sensors for your organisation.',
  },
]

const steps = [
  {
    n: '1',
    title: 'Deploy a sensor inside your network',
    body: 'The sensor is a Docker container that runs on any Linux machine on your network. It passively listens for devices and phones home every 60 seconds.',
    cta: { label: 'Go to Sensors →', href: '/dashboard/sensors' },
  },
  {
    n: '2',
    title: 'Devices appear automatically',
    body: 'Within 60–90 seconds of the sensor starting, every device that has sent a broadcast packet (ARP, DHCP, mDNS) will appear here with its IP, MAC, vendor, hostname, and OS hint.',
    cta: null,
  },
  {
    n: '3',
    title: 'Open ports are discovered every 4 hours',
    body: 'The optional active scanner runs nmap against all known IPs on a 4-hour cycle, mapping every open port, the service running on it, and its version banner. This reveals exposed databases, remote access services, and unpatched software.',
    cta: null,
  },
  {
    n: '4',
    title: 'CVE vulnerability matching runs nightly',
    body: 'Every night, Breachr fetches the latest CVEs from the NIST NVD database and cross-references them against each device\'s OS and running services. Matches are listed on the device detail page with severity rating and CVSS score.',
    cta: null,
  },
  {
    n: '5',
    title: 'Review, label, and investigate',
    body: 'Click any device to see its full profile: open ports, CVE findings, risk score, and sensor location. Update hostnames to label unknown devices. Focus remediation on high-risk assets first.',
    cta: null,
  },
]

export default function InventoryEmptyState() {
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
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(25,118,210,0.06) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
        }} />

        {/* Asset grid illustration */}
        <div style={{ marginBottom: 32, position: 'relative' }}>
          <svg width="360" height="100" viewBox="0 0 360 100" fill="none" style={{ maxWidth: '100%' }}>
            {/* Row of device cards */}
            {[0,1,2,3,4].map(i => {
              const x = 20 + i * 68
              const active = i < 3
              const risk = i === 0 ? '#ef4444' : i === 1 ? '#f97316' : '#22c55e'
              return (
                <g key={i}>
                  <rect x={x} y="10" width="52" height="70" rx="6"
                    fill={active ? 'rgba(25,118,210,0.08)' : 'rgba(255,255,255,0.03)'}
                    stroke={active ? 'rgba(25,118,210,0.25)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth="1" />
                  {active && <>
                    <rect x={x+8} y="20" width="36" height="5" rx="2" fill="rgba(255,255,255,0.1)" />
                    <rect x={x+8} y="30" width="24" height="4" rx="2" fill="rgba(255,255,255,0.06)" />
                    <rect x={x+8} y="38" width="28" height="4" rx="2" fill="rgba(255,255,255,0.06)" />
                    <rect x={x+8} y="54" width="16" height="14" rx="3"
                      fill={`${risk}22`}
                      stroke={`${risk}66`} strokeWidth="1" />
                    <text x={x+16} y="64" fontSize="9" fontWeight="700" fill={risk} textAnchor="middle">
                      {i === 0 ? '84' : i === 1 ? '52' : '8'}
                    </text>
                  </>}
                  {!active && <>
                    <rect x={x+8} y="20" width="36" height="5" rx="2" fill="rgba(255,255,255,0.05)" />
                    <rect x={x+8} y="30" width="20" height="4" rx="2" fill="rgba(255,255,255,0.03)" />
                    <text x={x+26} y="64" fontSize="8" fill="rgba(255,255,255,0.15)" textAnchor="middle">?</text>
                  </>}
                </g>
              )
            })}
            {/* Labels */}
            <text x="46" y="96" textAnchor="middle" fontSize="8" fill="#ef4444">CRITICAL</text>
            <text x="114" y="96" textAnchor="middle" fontSize="8" fill="#f97316">HIGH</text>
            <text x="182" y="96" textAnchor="middle" fontSize="8" fill="#22c55e">LOW</text>
            <text x="250" y="96" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.2)">UNKNOWN</text>
            <text x="318" y="96" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.2)">UNKNOWN</text>
          </svg>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 12, position: 'relative' }}>
          A live risk map of every device on your network
        </h2>
        <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 560, margin: '0 auto 28px', lineHeight: 1.7, position: 'relative' }}>
          The inventory module automatically discovers every device connected to your network, maps its open ports and running services, checks them against the NIST CVE database, and assigns a risk score. You get a continuously updated picture of your attack surface — no manual audits required.
        </p>
        <Link href="/dashboard/sensors" className="btn-p" style={{ fontSize: 14, padding: '10px 28px', position: 'relative', display: 'inline-block' }}>
          Deploy a sensor to get started →
        </Link>
      </div>

      {/* What you get per device */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          {
            icon: '⬡',
            color: '#42a5f5',
            title: 'Device identity',
            items: ['IP & MAC address', 'Hostname (mDNS / DHCP)', 'Vendor (from MAC prefix)', 'OS fingerprint'],
          },
          {
            icon: '◈',
            color: '#f59e0b',
            title: 'Open ports & services',
            items: ['Port number & protocol', 'Service name (ssh, http…)', 'Version banner', 'Updated every 4 hours'],
          },
          {
            icon: '◎',
            color: '#ef4444',
            title: 'Vulnerability findings',
            items: ['CVE ID & title', 'Severity (critical → low)', 'CVSS score', 'Refreshed nightly from NVD'],
          },
          {
            icon: '◉',
            color: '#a78bfa',
            title: 'Risk score',
            items: ['0–100 composite score', 'Critical CVE = +40 pts', 'High = +20 · Medium = +10', 'Sorted high → low'],
          },
        ].map(card => (
          <div key={card.title} className="gs" style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: 18, color: card.color, marginBottom: 10 }}>{card.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>{card.title}</div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {card.items.map(item => (
                <li key={item} style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: card.color, fontSize: 8 }}>▸</span> {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* What to look for */}
      <div className="gs" style={{ padding: '28px 32px', marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 20, letterSpacing: '0.04em' }}>
          WHAT TO INVESTIGATE WHEN YOU HAVE INVENTORY DATA
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            {
              color: '#ef4444',
              label: 'Unknown devices',
              body: 'Any asset with no hostname or an unrecognised vendor should be identified immediately. Rogue devices, personal hotspots, and unauthorised IoT kit all appear here first.',
            },
            {
              color: '#f97316',
              label: 'Exposed remote access',
              body: 'SSH (22), RDP (3389), VNC (5900) open on end-user machines are high-risk. Confirm each one is intentional. Old Telnet (23) or FTP (21) services should be disabled.',
            },
            {
              color: '#f59e0b',
              label: 'Databases visible on the network',
              body: 'MySQL (3306), Postgres (5432), MongoDB (27017), Redis (6379) should never be reachable outside a server segment. Flag any found on office subnets.',
            },
            {
              color: '#22c55e',
              label: 'High CVE score on core infrastructure',
              body: 'A router, firewall, or file server with a critical CVE needs immediate attention — it sits on the network path for all traffic. Patch or isolate.',
            },
          ].map(item => (
            <div key={item.label} style={{
              borderLeft: `2px solid ${item.color}44`,
              paddingLeft: 14,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: item.color, marginBottom: 5 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{item.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Step-by-step */}
      <div className="gs" style={{ padding: '28px 32px', marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 24, letterSpacing: '0.04em' }}>
          HOW TO BUILD YOUR INVENTORY — STEP BY STEP
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {steps.map((step, i) => (
            <div key={step.n} style={{ display: 'flex', gap: 20, paddingBottom: i < steps.length - 1 ? 28 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(25,118,210,0.15)',
                  border: '1px solid rgba(25,118,210,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: '#42a5f5', flexShrink: 0,
                }}>
                  {step.n}
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 1, width: 1, background: 'rgba(25,118,210,0.15)', marginTop: 8 }} />
                )}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>{step.title}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{step.body}</div>
                {step.cta && (
                  <Link href={step.cta.href} style={{
                    display: 'inline-block', marginTop: 10,
                    fontSize: 12, color: '#42a5f5', textDecoration: 'none',
                  }}>
                    {step.cta.label}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance callout */}
      <div className="gs" style={{ padding: '20px 28px', marginBottom: 24, borderLeft: '2px solid rgba(25,118,210,0.4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: '#42a5f5', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>DORA ART. 8</div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, maxWidth: 220 }}>ICT asset management — maintain an up-to-date inventory of all ICT assets and their interdependencies.</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#42a5f5', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>NIS2 ART. 21</div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, maxWidth: 220 }}>Network and information systems security — know what is on your network and its security posture.</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#42a5f5', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>PCI-DSS REQ 12.5</div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, maxWidth: 220 }}>Maintain an inventory of system components that are in scope for PCI-DSS, reviewed at least once every 12 months.</div>
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div className="gs" style={{ padding: '28px 32px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 20, letterSpacing: '0.04em' }}>
          FREQUENTLY ASKED QUESTIONS
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7, paddingBottom: 16 }}>
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
