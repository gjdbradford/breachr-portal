// components/dashboard/KpiGrid.tsx

interface KpiTile {
  label: string
  value: string
  suffix?: string
  sub: string
  accent: string
  borderColor: string
}

interface KpiGridProps {
  tiles: KpiTile[]
}

export default function KpiGrid({ tiles }: KpiGridProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: '1fr 1fr', gap: 8 }}>
      {tiles.map((tile) => (
        <div key={tile.label} style={{ background: 'rgba(13,20,40,0.7)', border: `1px solid ${tile.borderColor}`, borderRadius: 7, padding: '10px 12px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: tile.accent }} />
          <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{tile.label}</p>
          <p style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: tile.accent, marginBottom: 3 }}>
            {tile.value}{tile.suffix && <span style={{ fontSize: 13 }}>{tile.suffix}</span>}
          </p>
          <p style={{ fontSize: 9, color: '#64748b' }}>{tile.sub}</p>
        </div>
      ))}
    </div>
  )
}
