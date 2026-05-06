'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Framework = 'DORA' | 'NIS2' | 'PCI-DSS'
const VALID_FRAMEWORKS: Framework[] = ['DORA', 'NIS2', 'PCI-DSS']

const PERIOD_OPTIONS = [
  { label: 'Last 30 days',  value: 30 },
  { label: 'Last 90 days',  value: 90 },
  { label: 'Last 12 months', value: 365 },
]

const FRAMEWORK_COLOURS: Record<Framework, string> = {
  'DORA':    '#1976d2',
  'NIS2':    '#7b1fa2',
  'PCI-DSS': '#c62828',
}

export default function GenerateReportButton({
  enabledFrameworks,
}: {
  enabledFrameworks: string[]
}) {
  const router = useRouter()
  // enabledFrameworks comes from a server component and won't change after mount
  const available = enabledFrameworks.filter((f): f is Framework =>
    (VALID_FRAMEWORKS as string[]).includes(f)
  )

  const [open,       setOpen]       = useState(false)
  const [framework,  setFramework]  = useState<Framework>(available[0] ?? 'DORA')
  const [periodDays, setPeriodDays] = useState(90)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/compliance-reports/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ framework, period_days: periodDays }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      if (!body.reportId) throw new Error('Server returned no report ID')
      setOpen(false)
      router.push(`/dashboard/reports/${body.reportId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  if (available.length === 0) {
    return (
      <span style={{ fontSize: 12, color: '#475569' }}>
        No frameworks selected — add them in{' '}
        <a href="/dashboard/settings" style={{ color: '#42a5f5' }}>Settings</a>
      </span>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px',
          borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: '#1976d2', color: '#fff', border: 'none',
        }}
      >
        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Generate Report
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          {/* Dropdown */}
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50,
            width: 280, background: '#0d1428', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: 20, boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>
              Generate Compliance Report
            </p>

            {/* Framework selector */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Framework
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {available.map(fw => (
                  <button
                    key={fw}
                    type="button"
                    onClick={() => setFramework(fw)}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
                      cursor: 'pointer', border: 'none',
                      background: framework === fw
                        ? `${FRAMEWORK_COLOURS[fw]}30`
                        : 'rgba(255,255,255,0.05)',
                      color: framework === fw ? FRAMEWORK_COLOURS[fw] : '#64748b',
                      outline: framework === fw ? `1px solid ${FRAMEWORK_COLOURS[fw]}80` : 'none',
                    }}
                  >
                    {fw}
                  </button>
                ))}
              </div>
            </div>

            {/* Period selector */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Reporting Period
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPeriodDays(opt.value)}
                    style={{
                      textAlign: 'left', fontSize: 12, padding: '6px 10px', borderRadius: 5,
                      cursor: 'pointer', border: 'none',
                      background: periodDays === opt.value
                        ? 'rgba(25,118,210,0.15)'
                        : 'rgba(255,255,255,0.03)',
                      color: periodDays === opt.value ? '#42a5f5' : '#94a3b8',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 12 }}>{error}</p>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              style={{
                width: '100%', padding: '8px 0', borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer', border: 'none',
                background: loading ? 'rgba(25,118,210,0.5)' : '#1976d2',
                color: '#fff',
              }}
            >
              {loading ? 'Generating…' : `Generate ${framework} Report`}
            </button>

            <p style={{ fontSize: 10, color: '#475569', marginTop: 10, textAlign: 'center' }}>
              Covers all completed scans in the selected period
            </p>
          </div>
        </>
      )}
    </div>
  )
}
