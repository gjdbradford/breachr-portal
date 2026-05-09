'use client'

import { useState } from 'react'
import Link from 'next/link'
import LaunchScanButton from '@/components/LaunchScanButton'

const faqs = [
  {
    q: 'How long does a scan take?',
    a: 'Most scans complete in 5–15 minutes depending on the size of the target. We run concurrent checks in parallel to keep it fast. You\'ll see live progress in the scan detail view.',
  },
  {
    q: 'What does Breachr actually test?',
    a: 'We test for the OWASP Top 10 (injection, XSS, broken auth, IDOR, misconfigurations, and more), plus CVE-matched component vulnerabilities, exposed secrets, and misconfigured headers. The AI layer adds contextual reasoning on top of raw scan output.',
  },
  {
    q: 'Is scanning safe — will it affect my live site?',
    a: 'Yes, it\'s safe for production. We use passive techniques where possible and avoid destructive payloads. We never send write operations or DELETE requests to your target. For sensitive environments, contact us for a read-only scan mode.',
  },
  {
    q: 'What is a token and why does it count?',
    a: 'Each scan uses an AI model to reason about findings. Tokens measure how much AI analysis was performed — longer pages and more findings consume more tokens. Your plan includes a monthly token budget shown in the sidebar.',
  },
  {
    q: 'Can I scan the same target multiple times?',
    a: 'Yes. Re-scanning is how Breachr tracks remediation — we compare findings across scans and automatically mark issues as verified fixed when they no longer appear. Regular scanning is the core of a continuous security programme.',
  },
  {
    q: 'Do scans count toward my monthly limit?',
    a: 'Yes. Each completed scan uses one scan credit from your monthly allowance. Failed scans and queued scans that never start do not count. Unused credits do not roll over.',
  },
  {
    q: 'What\'s the difference between scan types?',
    a: 'Surface scans give a broad overview of your attack surface — headers, exposed endpoints, tech stack. Deep scans go further: they fuzz inputs, test authentication flows, and enumerate vulnerabilities in detected libraries. Both are included on all plans.',
  },
]

interface Props {
  surfaces: { id: string; name: string; target_url: string }[]
  tenantId: string
  planId: string
  scansThisMonth: number
  tokensThisMonth: number
}

export default function ScansEmptyState({ surfaces, tenantId, planId, scansThisMonth, tokensThisMonth }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div style={{ padding: '0 24px 48px', maxWidth: 860, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '40px 0 32px' }}>
        <div style={{ marginBottom: 24 }}>
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ margin: '0 auto' }}>
            <circle cx="36" cy="36" r="35" stroke="rgba(66,165,245,0.15)" strokeWidth="1.5" />
            <circle cx="36" cy="36" r="26" stroke="rgba(66,165,245,0.2)" strokeWidth="1" />
            <circle cx="36" cy="36" r="17" stroke="rgba(66,165,245,0.3)" strokeWidth="1" />
            <circle cx="36" cy="36" r="4" fill="#42a5f5" />
            {/* Scan line */}
            <line x1="36" y1="36" x2="36" y2="1" stroke="#42a5f5" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
            {/* Targets */}
            <circle cx="55" cy="22" r="2.5" fill="#ef4444" opacity="0.8" />
            <circle cx="20" cy="50" r="2.5" fill="#f59e0b" opacity="0.8" />
            <circle cx="58" cy="50" r="2.5" fill="#22c55e" opacity="0.8" />
            <circle cx="18" cy="24" r="2" fill="#64748b" opacity="0.5" />
          </svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>
          AI-powered security scanning
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.7 }}>
          Point Breachr at a target and we'll run an automated penetration test — checking for OWASP Top 10 vulnerabilities, exposed secrets, misconfigurations, and CVE-matched library issues.
        </p>
        {surfaces.length > 0 ? (
          <LaunchScanButton
            surfaces={surfaces}
            tenantId={tenantId}
            planId={planId}
            scansThisMonth={scansThisMonth}
            tokensThisMonth={tokensThisMonth}
          />
        ) : (
          <Link href="/dashboard/targets" className="btn-p" style={{ fontSize: 13, padding: '10px 24px' }}>
            Add a Target to Start →
          </Link>
        )}
      </div>

      {/* How it works */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>HOW IT WORKS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { step: '01', icon: '◎', title: 'Add a target', body: 'Enter the URL of the web application or API you want to test. We support any publicly accessible HTTP/HTTPS endpoint.' },
            { step: '02', icon: '⟳', title: 'Launch a scan', body: 'Choose a scan type and hit launch. The scan is queued instantly and typically starts within seconds.' },
            { step: '03', icon: '◈', title: 'AI analyses results', body: 'Our AI model reviews the raw output, filters false positives, and produces plain-English findings with CVSS scores.' },
            { step: '04', icon: '⚠', title: 'Review findings', body: 'Browse findings by severity, filter by OWASP category, assign owners, and track remediation across re-scans.' },
          ].map(({ step, icon, title, body }) => (
            <div key={step} style={{ padding: '20px 18px', background: '#0d1428' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#42a5f5', letterSpacing: '0.1em', fontFamily: 'monospace' }}>{step}</span>
                <span style={{ fontSize: 14, color: '#42a5f5' }}>{icon}</span>
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{title}</p>
              <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* What we test */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
        {[
          {
            label: 'OWASP Top 10',
            color: '#ef4444',
            desc: 'Full coverage of the 10 most critical web application security risks — injection, broken auth, XSS, IDOR, security misconfigurations, and more.',
          },
          {
            label: 'CVE Library Matching',
            color: '#f97316',
            desc: 'We fingerprint your tech stack and cross-reference against the NVD CVE database, flagging known vulnerabilities in libraries and frameworks.',
          },
          {
            label: 'AI Reasoning Layer',
            color: '#42a5f5',
            desc: 'Rather than just pattern matching, our AI model reasons about context — reducing false positives and surfacing findings that matter.',
          },
          {
            label: 'Compliance Mapping',
            color: '#a78bfa',
            desc: 'Every finding is mapped to DORA, NIS2, and PCI-DSS articles so you can see exactly how your scan results affect your compliance posture.',
          },
        ].map(({ label, color, desc }) => (
          <div key={label} style={{ padding: '16px 18px', borderRadius: 10, background: '#0d1428', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{label}</span>
            </div>
            <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Scan types */}
      <div style={{ marginBottom: 32, padding: '20px 24px', borderRadius: 10, background: 'rgba(66,165,245,0.04)', border: '1px solid rgba(66,165,245,0.12)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#42a5f5', marginBottom: 14, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Scan types</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { type: 'Surface Scan', time: '~5 min', desc: 'Rapid attack surface enumeration — headers, exposed endpoints, tech stack fingerprinting, and basic vulnerability checks. Good for a first look or frequent monitoring.' },
            { type: 'Deep Scan', time: '~15 min', desc: 'Full automated penetration test — fuzzes inputs, tests authentication flows, enumerates CVEs in detected libraries, and performs contextual AI analysis of every finding.' },
          ].map(({ type, time, desc }) => (
            <div key={type} style={{ display: 'flex', gap: 12 }}>
              <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: 'rgba(66,165,245,0.1)', border: '1px solid rgba(66,165,245,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14, color: '#42a5f5' }}>⟳</span>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{type}</span>
                  <span style={{ fontSize: 10, color: '#42a5f5', fontFamily: 'monospace' }}>{time}</span>
                </div>
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
