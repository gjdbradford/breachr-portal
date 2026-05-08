'use client'

import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function ExportButton({
  dataType,
  canExport,
}: {
  dataType: 'findings' | 'inventory' | 'audit_trail'
  canExport: boolean
}) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast]     = useState<string | null>(null)
  const searchParams          = useSearchParams()
  const ref                   = useRef<HTMLDivElement>(null)

  if (!canExport) return null

  async function queue(format: 'csv' | 'xlsx') {
    setOpen(false)
    setLoading(true)
    const filters: Record<string, string> = {}
    searchParams.forEach((v, k) => { if (k !== 'p') filters[k] = v })

    try {
      const res = await fetch('/api/exports', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data_type: dataType, format, filters }),
      })
      if (res.ok) {
        setToast('Export queued — you\'ll be emailed when it\'s ready.')
        setTimeout(() => setToast(null), 5000)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        style={{
          fontSize: 11, fontWeight: 600, padding: '4px 12px',
          background: 'rgba(25,118,210,0.12)',
          border: '1px solid rgba(25,118,210,0.25)',
          borderRadius: 4, color: '#42a5f5', cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 5, opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Queuing…' : <>↓ Export <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span></>}
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50,
            background: '#1a2235', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, padding: 4, minWidth: 140,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {(['csv', 'xlsx'] as const).map(fmt => (
              <button
                key={fmt}
                onClick={() => queue(fmt)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', fontSize: 12, color: '#94a3b8',
                  background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {fmt === 'csv' ? 'CSV' : 'Excel (.xlsx)'}
              </button>
            ))}
          </div>
        </>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          background: '#1a2235', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 8, padding: '12px 18px',
          fontSize: 13, color: '#e2e8f0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          maxWidth: 360,
        }}>
          <span style={{ color: '#22c55e', marginRight: 8 }}>✓</span>
          {toast}
        </div>
      )}
    </div>
  )
}
