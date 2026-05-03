'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Surface { id: string; name: string; target_url: string }

const SCAN_MODELS = [
  { id: 'claude-opus', label: 'Claude Opus 4', desc: 'Best for complex logic & auth flaws' },
  { id: 'llama-3.1', label: 'Llama 3.1 70B', desc: 'Fast — API & injection testing' },
  { id: 'multi-model', label: 'Multi-Model Ensemble', desc: 'All models · highest coverage' },
]

const SCAN_TYPES = [
  { id: 'full', label: 'Full Scan', desc: 'OWASP Top 10 + custom rules' },
  { id: 'api', label: 'API Scan', desc: 'REST/GraphQL endpoint fuzzing' },
  { id: 'tlpt', label: 'TLPT Exercise', desc: 'DORA Art. 26 threat-led' },
]

export default function LaunchScanButton({ surfaces, tenantId }: { surfaces: Surface[]; tenantId: string }) {
  const [open, setOpen] = useState(false)
  const [surfaceId, setSurfaceId] = useState(surfaces[0]?.id ?? '')
  const [scanType, setScanType] = useState('full')
  const [model, setModel] = useState('multi-model')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLaunch() {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('scans')
      .insert({
        tenant_id: tenantId,
        attack_surface_id: surfaceId,
        scan_type: scanType,
        status: 'queued',
        model_used: model,
        tests_total: 1247,
        tests_run: 0,
        progress_pct: 0,
        current_phase: 'queued',
      })
      .select('id')
      .single()

    if (!error && data) {
      // Non-blocking audit entry
      fetch('/api/audit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan.queued', detail: { scan_id: data.id, scan_type: scanType, model, surface_id: surfaceId } }),
      }).catch(e => console.error('audit log failed', e))
      setOpen(false)
      router.push(`/dashboard/scans/${data.id}`)
    } else {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-p" style={{ fontSize: 13, padding: '8px 18px' }}>
        + Launch Scan
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(7,11,20,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#0d1428', border: '1px solid rgba(25,118,210,0.3)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Fixed header */}
            <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em', marginBottom: 2 }}>LAUNCH SCAN</h2>
              <p style={{ fontSize: 12, color: '#64748b' }}>Configure your penetration test parameters.</p>
            </div>

            {/* Scrollable body */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '20px 28px' }}>

              {/* Target — most important, shown first and prominently */}
              <div style={{ marginBottom: 20 }}>
                <label className="form-label">Target</label>
                {surfaces.length === 1 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(25,118,210,0.4)', background: 'rgba(25,118,210,0.08)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{surfaces[0].name}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b', marginTop: 1 }}>{surfaces[0].target_url}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {surfaces.map(s => (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${surfaceId === s.id ? 'rgba(25,118,210,0.5)' : 'rgba(255,255,255,0.06)'}`, background: surfaceId === s.id ? 'rgba(25,118,210,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                        <input type="radio" name="surfaceId" value={s.id} checked={surfaceId === s.id} onChange={() => setSurfaceId(s.id)} style={{ accentColor: '#42a5f5', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{s.name}</div>
                          <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.target_url}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Scan Type</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SCAN_TYPES.map(t => (
                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${scanType === t.id ? 'rgba(25,118,210,0.5)' : 'rgba(255,255,255,0.06)'}`, background: scanType === t.id ? 'rgba(25,118,210,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                      <input type="radio" name="scanType" value={t.id} checked={scanType === t.id} onChange={() => setScanType(t.id)} style={{ accentColor: '#42a5f5' }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{t.label}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>{t.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <label className="form-label">AI Model</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SCAN_MODELS.map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${model === m.id ? 'rgba(25,118,210,0.5)' : 'rgba(255,255,255,0.06)'}`, background: model === m.id ? 'rgba(25,118,210,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                      <input type="radio" name="model" value={m.id} checked={model === m.id} onChange={() => setModel(m.id)} style={{ accentColor: '#42a5f5' }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{m.label}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>{m.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Fixed footer */}
            <div style={{ padding: '16px 28px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10 }}>
              <button onClick={() => setOpen(false)} className="btn-s" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleLaunch} className="btn-p pulse" style={{ flex: 2 }} disabled={loading}>
                {loading ? 'Launching…' : 'Launch Scan →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
