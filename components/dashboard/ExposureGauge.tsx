// components/dashboard/ExposureGauge.tsx
import type { ExposureDimension } from '@/lib/exposure-score'

interface ExposureGaugeProps {
  score: number
  dimensions: ExposureDimension[]
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Low Risk'
  if (score >= 50) return 'Medium Risk'
  return 'High Risk'
}

export default function ExposureGauge({ score, dimensions }: ExposureGaugeProps) {
  const color = scoreColor(score)
  const circumference = 2 * Math.PI * 32
  const dashArr = Math.round((score / 100) * circumference)

  return (
    <div style={{ background: 'rgba(13,20,40,0.9)', border: `1px solid rgba(245,158,11,0.2)`, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},#ef4444)` }} />
      <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Weighted Exposure</p>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <svg viewBox="0 0 80 80" width="80" height="80">
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          <circle cx="40" cy="40" r="32" fill="none"
            stroke={color} strokeWidth="7"
            strokeDasharray={`${dashArr} ${circumference}`}
            strokeDashoffset="50"
            strokeLinecap="round"
            transform="rotate(-90 40 40)" />
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>/100</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color, fontWeight: 600 }}>{scoreLabel(score)}</div>
      <div style={{ width: '100%' }}>
        {dimensions.map((d) => (
          <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 9 }}>
            <span style={{ color: '#64748b' }}>{d.label}</span>
            <span style={{ fontFamily: 'monospace', color: scoreColor(d.score), fontWeight: 600 }}>{d.score}%</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, color: '#475569', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 5, width: '100%' }}>
        Weighted across {dimensions.length} dimensions
      </div>
    </div>
  )
}
