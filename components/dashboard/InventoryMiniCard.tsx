// components/dashboard/InventoryMiniCard.tsx
import Link from 'next/link'

interface InventoryMiniCardProps {
  total: number
  servers: number
  services: number
  unreviewed: number
}

export default function InventoryMiniCard({ total, servers, services, unreviewed }: InventoryMiniCardProps) {
  return (
    <div style={{ background: 'rgba(13,20,40,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Inventory</p>
        <Link href="/dashboard/inventory" style={{ fontSize: 9, color: '#42a5f5', textDecoration: 'none' }}>→</Link>
      </div>
      <p style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', lineHeight: 1, marginBottom: 3 }}>{total}</p>
      <p style={{ fontSize: 9, color: '#64748b', marginBottom: 8 }}>assets discovered</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
          <span style={{ color: '#64748b' }}>Servers</span>
          <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{servers}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
          <span style={{ color: '#64748b' }}>Services</span>
          <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{services}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
          <span style={{ color: '#64748b' }}>Unreviewed</span>
          <span style={{ fontFamily: 'monospace', color: unreviewed > 0 ? '#f87171' : '#94a3b8' }}>{unreviewed}</span>
        </div>
      </div>
    </div>
  )
}
