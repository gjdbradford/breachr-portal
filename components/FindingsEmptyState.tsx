'use client'

import { useState } from 'react'
import Link from 'next/link'

const faqs = [
  {
    q: 'What\'s the difference between a finding and a vulnerability?',
    a: 'A finding is a potential security issue identified during a scan. It becomes a confirmed vulnerability once triaged and verified. Breachr marks findings with a confidence score and CVSS rating so you can prioritise triage.',
  },
  {
    q: 'What do the severity levels mean?',
    a: 'Critical (CVSS 9–10): immediate risk, exploitable remotely with no authentication. High (7–8.9): significant risk requiring prompt attention. Medium (4–6.9): real issues that may require specific conditions to exploit. Low (0–3.9): minor issues or hardening recommendations.',
  },
  {
    q: 'What is a CVSS score?',
    a: 'CVSS (Common Vulnerability Scoring System) is an industry-standard 0–10 scale for rating vulnerability severity. It accounts for attack vector, complexity, required privileges, and potential impact. Breachr uses CVSS v3.1.',
  },
  {
    q: 'How do I know if a finding is a false positive?',
    a: 'Our AI layer filters many false positives automatically. If you believe a finding is incorrect, you can mark it as "won\'t fix" with a note. It will be excluded from your compliance score but retained in the audit trail.',
  },
  {
    q: 'What does "verified fixed" mean?',
    a: 'When you re-scan a target and a previously open finding no longer appears, Breachr automatically marks it as verified fixed. This closes the remediation loop and improves your DORA compliance score.',
  },
  {
    q: 'Can I export findings for my security team?',
    a: 'Yes. Each scan generates a PDF report with all findings, CVSS scores, remediation steps, and compliance mapping. You can also export a BaFin evidence pack from the compliance dashboard.',
  },
  {
    q: 'Do findings affect my compliance score?',
    a: 'Yes. Open critical and high findings directly reduce your DORA and NIS2 compliance scores. Remediating them and running a verification scan is the fastest way to improve your posture.',
  },
]

export default function FindingsEmptyState() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div style={{ padding: '0 24px 48px', maxWidth: 860, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '40px 0 32px' }}>
        <div style={{ marginBottom: 24 }}>
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ margin: '0 auto' }}>
            {/* Shield */}
            <path d="M36 6L12 16v20c0 14 10.5 27 24 30 13.5-3 24-16 24-30V16L36 6z"
              fill="rgba(66,165,245,0.06)" stroke="rgba(66,165,245,0.25)" strokeWidth="1.5" />
            {/* Severity dots */}
            <circle cx="26" cy="28" r="3.5" fill="rgba(239,68,68,0.8)" />
            <circle cx="36" cy="28" r="3.5" fill="rgba(249,115,22,0.8)" />
            <circle cx="46" cy="28" r="3.5" fill="rgba(245,158,11,0.8)" />
            {/* Lines */}
            <line x1="22" y1="38" x2="50" y2="38" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <line x1="22" y1="44" x2="44" y2="44" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <line x1="22" y1="50" x2="38" y2="50" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          </svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>
          No findings yet
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.7 }}>
          Findings appear here after a scan completes. Each one is a potential vulnerability — rated by severity, mapped to OWASP and compliance frameworks, and tracked through to remediation.
        </p>
        <Link href="/dashboard/scans" className="btn-p" style={{ fontSize: 13, padding: '10px 24px' }}>
          Go to Scans →
        </Link>
      </div>

      {/* Severity explained */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>SEVERITY LEVELS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { level: 'Critical', range: 'CVSS 9–10', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', desc: 'Remotely exploitable with no authentication required. Fix immediately.' },
            { level: 'High',     range: 'CVSS 7–8.9', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', desc: 'Significant risk. Likely exploitable with minimal conditions. Fix within days.' },
            { level: 'Medium',   range: 'CVSS 4–6.9', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', desc: 'Real issues requiring specific conditions. Fix within your next release cycle.' },
            { level: 'Low',      range: 'CVSS 0–3.9', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', desc: 'Minor issues or hardening recommendations. Fix at your discretion.' },
          ].map(({ level, range, color, bg, border, desc }) => (
            <div key={level} style={{ padding: '16px 14px', borderRadius: 10, background: bg, border: `1px solid ${border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{level}</span>
                <span style={{ fontSize: 9, fontFamily: 'monospace', color, opacity: 0.7 }}>{range}</span>
              </div>
              <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* What you can do with findings */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>WHAT YOU CAN DO WITH FINDINGS</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            {
              icon: '▤', color: '#42a5f5',
              title: 'Triage by priority',
              body: 'Filter findings by severity, OWASP category, scan type, or target. Focus on the highest-risk issues first and work down.',
            },
            {
              icon: '⚠', color: '#f59e0b',
              title: 'Track remediation',
              body: 'Change the status of a finding to "in progress" or "won\'t fix". Re-scan to automatically verify fixes and close the loop.',
            },
            {
              icon: '◈', color: '#a78bfa',
              title: 'Map to compliance',
              body: 'Every finding is tagged with the relevant DORA, NIS2, and PCI-DSS articles. Remediating findings directly improves your compliance score.',
            },
            {
              icon: '▤', color: '#22c55e',
              title: 'Export evidence',
              body: 'Generate a PDF report with findings, CVSS scores, and remediation guidance — ready to share with your security team, auditors, or board.',
            },
          ].map(({ icon, color, title, body }) => (
            <div key={title} style={{ display: 'flex', gap: 14, padding: '16px 18px', borderRadius: 10, background: '#0d1428', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14, color }}>{icon}</span>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 5 }}>{title}</p>
                <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* OWASP reference */}
      <div style={{ marginBottom: 32, padding: '20px 24px', borderRadius: 10, background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.12)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>OWASP Top 10 — what we check</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 24px' }}>
          {[
            ['A01', 'Broken Access Control'],
            ['A02', 'Cryptographic Failures'],
            ['A03', 'Injection (SQL, NoSQL, LDAP)'],
            ['A04', 'Insecure Design'],
            ['A05', 'Security Misconfiguration'],
            ['A06', 'Vulnerable & Outdated Components'],
            ['A07', 'Identification & Auth Failures'],
            ['A08', 'Software & Data Integrity Failures'],
            ['A09', 'Security Logging & Monitoring'],
            ['A10', 'Server-Side Request Forgery'],
          ].map(([code, name]) => (
            <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#a78bfa', width: 28, flexShrink: 0 }}>{code}</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{name}</span>
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
