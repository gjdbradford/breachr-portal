'use client'

import { useState } from 'react'

type Mode = 'summary' | 'full'

export default function ReportDownloadButton({
  reportId,
  framework,
}: {
  reportId: string
  framework: string
}) {
  const [mode, setMode]       = useState<Mode>('summary')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleDownload() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/reports/${reportId}/pdf?mode=${mode}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `breachr-${framework.toLowerCase()}-${reportId.slice(0, 8)}-${mode}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message ?? 'Download failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
        {(['summary', 'full'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '5px 14px',
              fontSize: 11,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: mode === m ? '#1976d2' : 'transparent',
              color: mode === m ? '#fff' : '#64748b',
              transition: 'all 0.15s',
              textTransform: 'capitalize',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
          background: loading ? 'rgba(25,118,210,0.5)' : '#1976d2',
          color: '#fff', border: 'none', transition: 'background 0.15s',
        }}
      >
        {loading ? (
          <>
            <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            Generating PDF…
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download {mode === 'full' ? 'Full ' : ''}Evidence Pack
          </>
        )}
      </button>

      {error && <p style={{ fontSize: 11, color: '#ef4444', margin: 0 }}>{error}</p>}

      <p style={{ fontSize: 10, color: '#475569', margin: 0, textAlign: 'right' }}>
        SHA-256 signed · {mode === 'summary' ? 'Findings table only' : 'Full descriptions + remediation'}
      </p>
    </div>
  )
}
