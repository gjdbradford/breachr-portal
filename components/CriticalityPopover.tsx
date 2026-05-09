'use client'

import { useState, useRef, useEffect } from 'react'
import { CRITICALITY_META } from './AssetClassificationCard'

export function CriticalityBadgeSmall({ value }: { value: string | null }) {
  if (!value) {
    return (
      <span style={{ fontSize: 10, color: '#475569', padding: '2px 6px', borderRadius: 3,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        Unclassified
      </span>
    )
  }
  const m = CRITICALITY_META[value]
  if (!m) return null
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`, letterSpacing: '0.03em',
      whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  )
}

export function CriticalityPopover({
  assetId,
  value,
  onUpdated,
}: {
  assetId: string
  value: string | null
  onUpdated: (newValue: string | null) => void
}) {
  const [open, setOpen]       = useState(false)
  const [saving, setSaving]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function select(criticality: string | null) {
    setSaving(true)
    const res = await fetch(`/api/assets/${assetId}/classify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criticality }),
    })
    if (res.ok) onUpdated(criticality)
    setSaving(false)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <CriticalityBadgeSmall value={value} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4,
          background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: 6, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 10, color: '#475569', padding: '2px 8px 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Set criticality
          </div>
          {Object.entries(CRITICALITY_META).map(([v, m]) => (
            <button
              key={v}
              type="button"
              onClick={() => select(v)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 8px', borderRadius: 5, fontSize: 12,
                background: value === v ? m.bg : 'none',
                color: value === v ? m.color : '#94a3b8',
                border: 'none', cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          ))}
          {value && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
              <button
                type="button"
                onClick={() => select(null)}
                style={{ display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 8px', borderRadius: 5, fontSize: 12,
                  background: 'none', color: '#475569', border: 'none', cursor: 'pointer' }}
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
