// components/dashboard/TargetsCard.tsx
import Link from 'next/link'

export interface TargetTypeSummary {
  type: string
  count: number
  cleanCount: number
  findingsCount: number
  criticalCount: number
}

const TYPE_DISPLAY: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  web:    { label: 'Web Applications',     icon: '🌐', color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  api:    { label: 'API Endpoints',         icon: '⚡', color: '#c4b5fd', bg: 'rgba(167,139,250,0.12)' },
  cloud:  { label: 'Cloud / Infrastructure', icon: '☁',  color: '#2dd4bf', bg: 'rgba(20,184,166,0.12)' },
  mobile: { label: 'Mobile Apps',           icon: '📱', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  other:  { label: 'Other',                 icon: '◎',  color: '#94a3b8', bg: 'rgba(100,116,139,0.12)' },
}

interface TargetsCardProps {
  summaries: TargetTypeSummary[]
  totalCount: number
}

export default function TargetsCard({ summaries, totalCount }: TargetsCardProps) {
  return (
    <div style={{ background: 'rgba(13,20,40,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Target Endpoints
          {totalCount > 0 && <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 5, textTransform: 'none', letterSpacing: 'normal', fontSize: 10 }}>({totalCount})</span>}
        </span>
        <Link href="/dashboard/targets" style={{ fontSize: 10, color: '#42a5f5', textDecoration: 'none' }}>View all →</Link>
      </div>
      {summaries.length === 0 ? (
        <div style={{ padding: '20px 14px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#475569' }}>No targets added yet.</p>
          <Link href="/onboarding" style={{ fontSize: 11, color: '#42a5f5' }}>Add a target →</Link>
        </div>
      ) : (
        summaries.map((s) => {
          const display = TYPE_DISPLAY[s.type] ?? TYPE_DISPLAY.other
          return (
            <div key={s.type} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ width: 22, height: 22, borderRadius: 5, background: display.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>
                {display.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{display.label}</div>
                <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                  {s.cleanCount > 0 && (
                    <span style={{ fontSize: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>
                      {s.cleanCount} clean
                    </span>
                  )}
                  {s.findingsCount > 0 && (
                    <span style={{ fontSize: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>
                      {s.findingsCount} findings
                    </span>
                  )}
                  {s.criticalCount > 0 && (
                    <span style={{ fontSize: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 3, padding: '1px 5px', fontWeight: 600 }}>
                      {s.criticalCount} critical
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: display.color, fontFamily: 'monospace' }}>{s.count}</div>
            </div>
          )
        })
      )}
    </div>
  )
}
