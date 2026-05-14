// components/dashboard/FrameworkRow.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { FrameworkScore } from '@/lib/frameworks'
import { FRAMEWORK_COLOR } from '@/lib/frameworks'

interface FrameworkRowProps {
  score: FrameworkScore
  frameworkName: string
}

function statusPill(s: number) {
  if (s >= 80) return { label: '✓ Compliant',    color: '#4ade80', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)' }
  if (s >= 50) return { label: '⚠ Partial',      color: '#fbbf24', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' }
  if (s > 0)   return { label: '✗ Non-compliant', color: '#f87171', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)' }
  return       { label: '○ Not assessed',  color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' }
}

const FRAMEWORK_SHORTCUTS: Record<string, { label: string; href: string; color: string; borderColor: string; bgColor: string }[]> = {
  'DORA':    [
    { label: '📄 Export BaFin Pack', href: '/dashboard/reports', color: '#42a5f5', borderColor: 'rgba(66,165,245,0.3)', bgColor: 'rgba(66,165,245,0.08)' },
    { label: '📋 DORA Report',       href: '/dashboard/reports', color: '#4ade80', borderColor: 'rgba(34,197,94,0.3)',  bgColor: 'rgba(34,197,94,0.08)' },
    { label: '⬡ Inventory',          href: '/dashboard/inventory', color: '#64748b', borderColor: 'rgba(100,116,139,0.2)', bgColor: 'rgba(100,116,139,0.06)' },
  ],
  'PCI-DSS': [
    { label: '📄 PCI-DSS Report',    href: '/dashboard/reports',   color: '#42a5f5', borderColor: 'rgba(66,165,245,0.3)', bgColor: 'rgba(66,165,245,0.08)' },
    { label: '🔐 Cardholder Scope',  href: '/dashboard/inventory', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)', bgColor: 'rgba(245,158,11,0.08)' },
  ],
  'NIS2':    [
    { label: '📄 NIS2 Report',       href: '/dashboard/reports', color: '#42a5f5', borderColor: 'rgba(66,165,245,0.3)', bgColor: 'rgba(66,165,245,0.08)' },
    { label: '✓ Export evidence',    href: '/dashboard/reports', color: '#4ade80', borderColor: 'rgba(34,197,94,0.3)',  bgColor: 'rgba(34,197,94,0.08)' },
  ],
}

export default function FrameworkRow({ score, frameworkName }: FrameworkRowProps) {
  const color = FRAMEWORK_COLOR[score.id] ?? '#64748b'
  const storageKey = `fw-expanded-${score.id}`
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(storageKey) === 'true')
    } catch { /* noop */ }
  }, [storageKey])

  function toggle() {
    const next = !open
    setOpen(next)
    try { localStorage.setItem(storageKey, String(next)) } catch { /* noop */ }
  }

  const criticals = score.articles.filter(a => a.score > 0 && a.score < 50).length
  const borderColor = `${color}33`
  const bgColor = `${color}10`
  const shortcuts = FRAMEWORK_SHORTCUTS[score.id] ?? []

  return (
    <div style={{ borderRadius: 7, overflow: 'hidden', border: `1px solid ${borderColor}` }}>
      {/* Header row — always visible */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => e.key === 'Enter' && toggle()}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: bgColor, cursor: 'pointer' }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color, minWidth: 62, letterSpacing: '0.02em' }}>{frameworkName}</span>
        <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${score.overall}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 34, textAlign: 'right', fontFamily: 'monospace' }}>{score.overall}%</span>
        {criticals > 0 ? (
          <span style={{ fontSize: 9, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 3, padding: '2px 6px', whiteSpace: 'nowrap' }}>
            {criticals} critical
          </span>
        ) : score.overall >= 80 ? (
          <span style={{ fontSize: 9, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', borderRadius: 3, padding: '2px 6px' }}>
            Compliant
          </span>
        ) : null}
        <span style={{ fontSize: 10, color: '#475569', marginLeft: 2, transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>

      {/* Body — articles table on expand */}
      {open && (
        <div style={{ padding: '8px 12px 10px', background: 'rgba(10,14,26,0.5)', borderTop: `1px solid ${color}1a` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Article', 'Requirement', 'Score', 'Status'].map(h => (
                  <th key={h} style={{ fontSize: 8, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '3px 6px 5px', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {score.articles.map((art) => {
                const pill = statusPill(art.score)
                return (
                  <tr key={art.ref}>
                    <td style={{ padding: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#475569', whiteSpace: 'nowrap' }}>{art.ref}</span>
                    </td>
                    <td style={{ padding: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{art.name}</div>
                      <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>{art.desc}</div>
                    </td>
                    <td style={{ padding: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, minWidth: 60, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${art.score}%`, background: art.score >= 80 ? '#22c55e' : art.score >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#64748b', minWidth: 28 }}>{art.score > 0 ? `${art.score}%` : '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 3, fontSize: 9, fontWeight: 600, padding: '2px 6px', whiteSpace: 'nowrap', color: pill.color, background: pill.bg, border: `1px solid ${pill.border}` }}>
                        {pill.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {shortcuts.length > 0 && (
            <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
              {shortcuts.map((s) => (
                <Link key={s.label} href={s.href} style={{ fontSize: 9, borderRadius: 4, padding: '3px 8px', fontWeight: 500, border: `1px solid ${s.borderColor}`, background: s.bgColor, color: s.color, textDecoration: 'none' }}>
                  {s.label}
                </Link>
              ))}
              <Link href={`/dashboard/findings`} style={{ fontSize: 9, borderRadius: 4, padding: '3px 8px', fontWeight: 500, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', textDecoration: 'none' }}>
                ⚠ View Findings
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
