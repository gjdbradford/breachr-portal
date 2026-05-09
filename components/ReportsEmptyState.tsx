'use client'

import { useState } from 'react'
import Link from 'next/link'

const faqs = [
  {
    q: 'What frameworks do the reports cover?',
    a: 'Reports are generated for DORA, NIS2, PCI-DSS v4.0, HIPAA, ISO 27001, and SOC 2. Each report maps your scan findings directly to the relevant articles and requirements. Enable the frameworks applicable to your organisation in Settings → Compliance.',
  },
  {
    q: 'Do I need to run a scan before generating a report?',
    a: 'Yes — reports are built from scan data. Run at least one scan first, then generate a report to see how your findings map to the compliance framework of your choice.',
  },
  {
    q: 'What\'s the difference between a scan report and an organisational report?',
    a: 'A scan report covers findings from a single scan run — useful for sharing with developers or tracking a specific release. An organisational report aggregates data across all scans and targets, giving auditors and board members a full picture of your security posture.',
  },
  {
    q: 'Are reports cryptographically signed?',
    a: 'Yes. Every report is HMAC-signed and linked into the audit chain at generation time. This gives you tamper-evident proof of your compliance posture at a specific point in time — exactly what DORA and NIS2 auditors ask for.',
  },
  {
    q: 'Can I share reports externally?',
    a: 'Yes. Reports are generated as PDFs and can be downloaded and shared with auditors, regulators, insurers, or your board. For DORA Article 24/25, we also generate a BaFin evidence pack from the compliance dashboard.',
  },
  {
    q: 'How often should I generate reports?',
    a: 'For DORA and NIS2 compliance, best practice is to generate an organisational report after every major scan cycle, and retain at least 2 years of reports. Breachr keeps your full report history with timestamps in the audit trail.',
  },
  {
    q: 'What does the compliance score in a report mean?',
    a: 'The score reflects how well your current scan results satisfy the requirements of the chosen framework. It accounts for open findings severity, remediation rate, scan coverage, and audit trail completeness. It\'s not a certification — it\'s a directional posture metric.',
  },
]

interface Props {
  enabledFrameworks: string[]
}

export default function ReportsEmptyState({ enabledFrameworks }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div style={{ padding: '0 24px 48px', maxWidth: 860, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '40px 0 32px' }}>
        <div style={{ marginBottom: 24 }}>
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ margin: '0 auto' }}>
            {/* Document */}
            <rect x="14" y="8" width="38" height="50" rx="4" fill="rgba(66,165,245,0.06)" stroke="rgba(66,165,245,0.2)" strokeWidth="1.5" />
            <rect x="14" y="8" width="38" height="12" rx="4" fill="rgba(66,165,245,0.1)" />
            {/* Lines */}
            <line x1="22" y1="30" x2="50" y2="30" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="22" y1="38" x2="50" y2="38" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="22" y1="46" x2="40" y2="46" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" strokeLinecap="round" />
            {/* Badge */}
            <circle cx="52" cy="52" r="12" fill="#0d1428" stroke="rgba(66,165,245,0.3)" strokeWidth="1.5" />
            <path d="M47 52l4 4 6-7" stroke="#42a5f5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>
          Compliance reports, ready to share
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.7 }}>
          Generate cryptographically signed reports mapped to DORA, NIS2, PCI-DSS, HIPAA, ISO 27001, and SOC 2. Each report is built from your scan history and links directly to the findings and evidence auditors need.
        </p>
        <Link href="/dashboard/scans" className="btn-p" style={{ fontSize: 13, padding: '10px 24px' }}>
          Run a Scan First →
        </Link>
      </div>

      {/* What a report contains */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>WHAT A REPORT CONTAINS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { icon: '◈', title: 'Posture score', body: 'An overall compliance score with a breakdown by framework article, showing where you\'re compliant and where action is needed.' },
            { icon: '⚠', title: 'Open findings', body: 'Every unresolved vulnerability mapped to the relevant regulatory article — critical issues surfaced with remediation priority.' },
            { icon: '⛓', title: 'Audit evidence', body: 'Cryptographic proof that the report reflects real scan data — HMAC-signed and linked to your tamper-evident audit chain.' },
            { icon: '▤', title: 'Remediation plan', body: 'Actionable steps for each finding, with estimated impact on your compliance score if resolved.' },
          ].map(({ icon, title, body }) => (
            <div key={title} style={{ padding: '20px 18px', background: '#0d1428' }}>
              <div style={{ fontSize: 18, color: '#42a5f5', marginBottom: 10 }}>{icon}</div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{title}</p>
              <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Frameworks */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>SUPPORTED FRAMEWORKS</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              id: 'DORA',
              name: 'DORA — Digital Operational Resilience Act',
              region: 'EU · Financial sector',
              color: '#42a5f5',
              desc: 'Mandatory for EU financial institutions from January 2025. Breachr maps scan findings to Articles 5–10 (ICT risk management), Article 17 (incident classification), and Articles 24–26 (penetration testing / TIBER-EU). Our DORA report is the evidence pack your regulator asks for.',
              articles: ['Art. 5–10: ICT Risk Management', 'Art. 17: Incident Management', 'Art. 24: General ICT Testing', 'Art. 25: Advanced Testing (TLPT)', 'Art. 26: TIBER-EU'],
            },
            {
              id: 'NIS2',
              name: 'NIS2 — Network and Information Security Directive 2',
              region: 'EU · All sectors',
              color: '#a78bfa',
              desc: 'Expanded cybersecurity obligations for essential and important entities across the EU. NIS2 requires asset management, vulnerability handling, supply chain security, and regular security testing. Breachr maps findings to the relevant NIS2 measures and produces evidence for supervisory audits.',
              articles: ['Art. 21: Security measures', 'Art. 23: Incident reporting', 'Annex I/II: Essential entities'],
            },
            {
              id: 'PCI-DSS',
              name: 'PCI-DSS v4.0 — Payment Card Industry Data Security Standard',
              region: 'Global · Card payments',
              color: '#22c55e',
              desc: 'Required for any organisation that stores, processes, or transmits cardholder data. Breachr covers the technical requirements: vulnerability scanning (Req 11.3), penetration testing (Req 11.4), and system component inventory (Req 2.4). Reports include the evidence needed for your QSA assessment.',
              articles: ['Req 2.4: System inventory', 'Req 6.3: Vulnerability management', 'Req 11.3: Vulnerability scanning', 'Req 11.4: Penetration testing'],
            },
            {
              id: 'HIPAA',
              name: 'HIPAA — Health Insurance Portability & Accountability Act',
              region: 'US · Health data',
              color: '#d97706',
              desc: 'Applies to covered entities and business associates handling protected health information (PHI). Breachr maps findings to the HIPAA Security Rule technical safeguards — access controls, audit controls, integrity, and transmission security.',
              articles: ['§164.312(a): Access Control', '§164.312(b): Audit Controls', '§164.312(c): Integrity', '§164.312(e): Transmission Security'],
            },
            {
              id: 'ISO27001',
              name: 'ISO 27001 — Information Security Management',
              region: 'Global · All sectors',
              color: '#94a3b8',
              desc: 'The internationally recognised standard for information security management systems (ISMS). Breachr maps scan findings to Annex A controls covering access management, cryptography, vulnerability management, and secure development.',
              articles: ['A.5.15: Access Control', 'A.8.8: Vulnerability Management', 'A.8.24: Cryptography', 'A.8.25: Secure Development'],
            },
            {
              id: 'SOC2',
              name: 'SOC 2 — Service Organisation Control 2',
              region: 'US · SaaS / Cloud',
              color: '#0891b2',
              desc: 'Trust services criteria used by SaaS and cloud providers to demonstrate security, availability, and confidentiality controls to customers. Breachr maps findings to the Common Criteria (CC) covering logical access, change management, and risk mitigation.',
              articles: ['CC6.1: Logical Access', 'CC6.6: Security Boundaries', 'CC7.1: Vulnerability Detection', 'CC8.1: Change Management'],
            },
          ].map(({ id, name, region, color, desc, articles }) => {
            const enabled = enabledFrameworks.length === 0 || enabledFrameworks.includes(id)
            return (
              <div key={id} style={{ padding: '20px 24px', borderRadius: 10, background: '#0d1428', border: `1px solid ${enabled ? `${color}25` : 'rgba(255,255,255,0.06)'}`, opacity: enabled ? 1 : 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 800, color, letterSpacing: '0.06em', marginRight: 10 }}>{id}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{name.replace(`${id} — `, '')}</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>{region}</span>
                </div>
                <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6, marginBottom: 12 }}>{desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {articles.map(a => (
                    <span key={a} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: `${color}10`, color, border: `1px solid ${color}20` }}>{a}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Report types */}
      <div style={{ marginBottom: 32, padding: '20px 24px', borderRadius: 10, background: 'rgba(66,165,245,0.04)', border: '1px solid rgba(66,165,245,0.12)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#42a5f5', marginBottom: 14, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Report types</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            {
              type: 'Scan Report',
              desc: 'Generated per scan. Shows findings, CVSS scores, and compliance mapping for a single scan run. Share with developers or attach to a release sign-off.',
            },
            {
              type: 'Organisational Report',
              desc: 'Aggregates across all scans and targets. Gives auditors and the board a complete picture of your security posture at a point in time. Signed and retained for 2 years.',
            },
          ].map(({ type, desc }) => (
            <div key={type} style={{ display: 'flex', gap: 12 }}>
              <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: 'rgba(66,165,245,0.1)', border: '1px solid rgba(66,165,245,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14, color: '#42a5f5' }}>▤</span>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{type}</p>
                <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>FREQUENTLY ASKED QUESTIONS</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: '#0d1428' }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: '100%', textAlign: 'left', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>{faq.q}</span>
                <span style={{ fontSize: 14, color: '#42a5f5', flexShrink: 0, transition: 'transform 0.15s', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 16px 14px' }}>
                  <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
