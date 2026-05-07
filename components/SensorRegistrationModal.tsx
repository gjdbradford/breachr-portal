'use client'

import { useState } from 'react'

interface Props {
  onClose: () => void
}

export default function SensorRegistrationModal({ onClose }: Props) {
  const [name, setName]         = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [result, setResult]     = useState<{ id: string; token: string } | null>(null)
  const [copied, setCopied]     = useState(false)

  const apiUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function handleRegister() {
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/sensors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), location: location.trim() }),
    })
    setLoading(false)
    if (!res.ok) { setError((await res.json()).error ?? 'Failed'); return }
    setResult(await res.json())
  }

  const dockerCmd = result
    ? `docker run -d --network host \\\n  -e BREACHR_SENSOR_TOKEN=${result.token} \\\n  -e BREACHR_SENSOR_ID=${result.id} \\\n  -e BREACHR_API_URL=${apiUrl} \\\n  ghcr.io/breachr/sensor:latest`
    : ''

  async function copyCmd() {
    await navigator.clipboard.writeText(dockerCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0f1629', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
        padding: 32, width: 520, maxWidth: '90vw',
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>Add Sensor</h2>

        {!result ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Office London"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Location (optional)</label>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="2nd floor server room"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            {error && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 16 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleRegister} disabled={loading} className="btn-p"
                style={{ fontSize: 13, padding: '8px 20px' }}>
                {loading ? 'Registering…' : 'Register sensor'}
              </button>
              <button onClick={onClose} style={{ fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 1.6 }}>
              Sensor registered. Copy the command below and run it on a machine inside your network.{' '}
              <strong style={{ color: '#ef4444' }}>The token will not be shown again.</strong>
            </p>
            <div style={{
              background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 16, marginBottom: 16,
              fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', whiteSpace: 'pre-wrap',
              border: '1px solid rgba(255,255,255,0.08)', wordBreak: 'break-all',
            }}>
              {dockerCmd}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={copyCmd} className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }}>
                {copied ? 'Copied!' : 'Copy command'}
              </button>
              <button onClick={onClose} style={{ fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
