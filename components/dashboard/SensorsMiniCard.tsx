// components/dashboard/SensorsMiniCard.tsx
import Link from 'next/link'

interface SensorSummary {
  id: string
  name: string
  location: string | null
  status: string  // 'online' | 'offline' | other
}

interface SensorsMiniCardProps {
  sensors: SensorSummary[]
}

export default function SensorsMiniCard({ sensors }: SensorsMiniCardProps) {
  const online = sensors.filter(s => s.status === 'online').length
  const offline = sensors.length - online

  return (
    <div style={{ background: 'rgba(13,20,40,0.7)', border: '1px solid rgba(20,184,166,0.15)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sensors</p>
        <Link href="/dashboard/sensors" style={{ fontSize: 9, color: '#42a5f5', textDecoration: 'none' }}>→</Link>
      </div>
      <p style={{ fontSize: 20, fontWeight: 800, color: '#14b8a6', lineHeight: 1, marginBottom: 3 }}>{online}</p>
      <p style={{ fontSize: 9, color: '#64748b', marginBottom: 8 }}>online{offline > 0 ? ` · ${offline} offline` : ' · 0 offline'}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {sensors.slice(0, 4).map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.status === 'online' ? '#22c55e' : '#334155', flexShrink: 0 }} />
            <span style={{ color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.location ?? s.name}</span>
          </div>
        ))}
        {sensors.length > 4 && <span style={{ fontSize: 9, color: '#475569' }}>+{sensors.length - 4} more</span>}
      </div>
    </div>
  )
}
