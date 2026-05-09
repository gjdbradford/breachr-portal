'use client'

import { useRef, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type ToastState =
  | { phase: 'processing' }
  | { phase: 'ready'; rowCount: number }
  | { phase: 'email'; rowCount?: number }
  | { phase: 'error'; message: string }

const EXPORTS_URL = '/dashboard/reports?tab=exports'
// Poll for up to 10s before switching to "we'll email you"
const POLL_INTERVAL_MS = 2000
const POLL_MAX         = 5

export default function ExportButton({
  dataType,
  canExport,
}: {
  dataType: 'findings' | 'inventory' | 'audit_trail'
  canExport: boolean
}) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast,   setToast]   = useState<ToastState | null>(null)
  const searchParams          = useSearchParams()
  const ref                   = useRef<HTMLDivElement>(null)
  const pollRef               = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])

  if (!canExport) return null

  function dismissToast() {
    setToast(null)
    if (pollRef.current) clearTimeout(pollRef.current)
  }

  async function pollStatus(exportId: string, attempt = 0) {
    try {
      const res  = await fetch('/api/exports')
      const list = await res.json() as { id: string; status: string; row_count?: number }[]
      const job  = list.find(e => e.id === exportId)

      if (job?.status === 'ready') {
        setToast({ phase: 'ready', rowCount: job.row_count ?? 0 })
        return
      }
      if (job?.status === 'failed') {
        setToast({ phase: 'error', message: 'Export failed — please try again.' })
        return
      }
    } catch { /* ignore poll errors */ }

    if (attempt < POLL_MAX) {
      pollRef.current = setTimeout(() => pollStatus(exportId, attempt + 1), POLL_INTERVAL_MS)
    } else {
      // Timed out — switch to email message
      setToast({ phase: 'email' })
    }
  }

  async function queue(format: 'csv' | 'xlsx') {
    setOpen(false)
    setLoading(true)
    setToast({ phase: 'processing' })
    const filters: Record<string, string> = {}
    searchParams.forEach((v, k) => { if (k !== 'p') filters[k] = v })

    try {
      const res  = await fetch('/api/exports', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data_type: dataType, format, filters }),
      })
      const body = await res.json()
      if (res.ok && body.id) {
        pollStatus(body.id)
      } else {
        setToast({ phase: 'error', message: body.error ?? 'Failed to queue export.' })
      }
    } catch {
      setToast({ phase: 'error', message: 'Network error — please try again.' })
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
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
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

      {toast && <ExportToast state={toast} onDismiss={dismissToast} />}
    </div>
  )
}

function ExportToast({ state, onDismiss }: { state: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (state.phase === 'ready' || state.phase === 'error') {
      const t = setTimeout(onDismiss, 8000)
      return () => clearTimeout(t)
    }
  }, [state.phase, onDismiss])

  const borderColor =
    state.phase === 'ready'      ? 'rgba(34,197,94,0.35)'  :
    state.phase === 'error'      ? 'rgba(239,68,68,0.35)'  :
    state.phase === 'email'      ? 'rgba(66,165,245,0.35)' :
    'rgba(255,255,255,0.12)'

  const icon =
    state.phase === 'ready'      ? <span style={{ color: '#22c55e', fontSize: 16 }}>✓</span> :
    state.phase === 'error'      ? <span style={{ color: '#ef4444', fontSize: 16 }}>✗</span> :
    state.phase === 'email'      ? <span style={{ color: '#42a5f5', fontSize: 16 }}>✉</span> :
    <Spinner />

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 100,
      background: '#0f1729', border: `1px solid ${borderColor}`,
      borderRadius: 10, padding: '14px 18px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      maxWidth: 340, minWidth: 280,
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ flexShrink: 0, marginTop: 1 }}>{icon}</div>

      <div style={{ flex: 1 }}>
        {state.phase === 'processing' && (
          <>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Generating export…</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>This usually takes a few seconds.</p>
          </>
        )}

        {state.phase === 'ready' && (
          <>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#22c55e' }}>
              Export ready — {state.rowCount.toLocaleString()} rows
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b' }}>
              <Link href={EXPORTS_URL} style={{ color: '#42a5f5', textDecoration: 'none', fontWeight: 600 }}
                onClick={onDismiss}>
                View &amp; download in Reports → Exports →
              </Link>
            </p>
          </>
        )}

        {state.phase === 'email' && (
          <>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Large export queued</p>
            <p style={{ margin: '4px 0 6px', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              We'll email you when it's ready. Your export will appear in{' '}
              <Link href={EXPORTS_URL} style={{ color: '#42a5f5', textDecoration: 'none' }} onClick={onDismiss}>
                Reports → Exports
              </Link>
              {' '}once complete.
            </p>
          </>
        )}

        {state.phase === 'error' && (
          <p style={{ margin: 0, fontSize: 13, color: '#ef4444' }}>{state.message}</p>
        )}
      </div>

      <button
        onClick={onDismiss}
        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 16, lineHeight: 1, padding: 0 }}
      >
        ×
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="#42a5f5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
