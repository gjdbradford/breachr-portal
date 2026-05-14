// components/dashboard/InventoryMiniCard.tsx
import Link from 'next/link'

interface InventoryMiniCardProps {
  total: number
  unreviewed: number
  riskCounts: { critical: number; high: number; medium: number; low: number }
}

const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#22c55e',
}

export default function InventoryMiniCard({ total, unreviewed, riskCounts }: InventoryMiniCardProps) {
  const hasRisk = Object.values(riskCounts).some(v => v > 0)

  return (
    <div style={{ background: 'rgba(13,20,40,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Inventory</p>
        <Link href="/dashboard/inventory" style={{ fontSize: 9, color: '#42a5f5', textDecoration: 'none' }}>→</Link>
      </div>
      <p style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', lineHeight: 1, marginBottom: 3 }}>{total}</p>
      <p style={{ fontSize: 9, color: '#64748b', marginBottom: 8 }}>
        {unreviewed > 0 ? <span style={{ color: '#f87171' }}>{unreviewed} unreviewed</span> : 'all reviewed'}
      </p>
      {hasRisk ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(['critical', 'high', 'medium', 'low'] as const).map(level => (
            riskCounts[level] > 0 && (
              <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: RISK_COLORS[level], flexShrink: 0 }} />
                <span style={{ color: '#64748b', flex: 1, textTransform: 'capitalize' }}>{level}</span>
                <span style={{ fontFamily: 'monospace', color: RISK_COLORS[level], fontWeight: 700 }}>{riskCounts[level]}</span>
              </div>
            )
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 9, color: '#334155' }}>No risk scores yet</p>
      )}
    </div>
  )
}
