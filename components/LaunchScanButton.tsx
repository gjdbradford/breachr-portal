'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Surface { id: string; name: string; target_url: string }

// Cost model: Claude Sonnet 4.6 pricing
// Input: $3.00/M tokens  |  Output: $15.00/M tokens
const SCAN_TYPES = [
  {
    id: 'full',
    label: 'Full Scan',
    desc: 'OWASP Top 10 + custom rules',
    estTokensIn: 20000,
    estTokensOut: 4000,
    estCost: 0.12,
  },
  {
    id: 'api',
    label: 'API Scan',
    desc: 'REST/GraphQL endpoint fuzzing',
    estTokensIn: 12000,
    estTokensOut: 2500,
    estCost: 0.07,
  },
  {
    id: 'tlpt',
    label: 'TLPT Exercise',
    desc: 'DORA Art. 26 threat-led',
    estTokensIn: 32000,
    estTokensOut: 6000,
    estCost: 0.19,
  },
]

function fmtCost(usd: number) {
  return usd < 0.01 ? '<$0.01' : `~$${usd.toFixed(2)}`
}

function fmtTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n)
}

export default function LaunchScanButton({
  surfaces,
  tenantId,
  monthlyBudgetUsd,
  usedBudgetUsd,
}: {
  surfaces: Surface[]
  tenantId: string
  monthlyBudgetUsd?: number
  usedBudgetUsd?: number
}) {
  const [open, setOpen] = useState(false)
  const [surfaceId, setSurfaceId] = useState(surfaces[0]?.id ?? '')
  const [scanType, setScanType] = useState('full')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const selectedType = SCAN_TYPES.find(t => t.id === scanType) ?? SCAN_TYPES[0]
  const remainingBudget = monthlyBudgetUsd != null && usedBudgetUsd != null
    ? monthlyBudgetUsd - usedBudgetUsd
    : null
  const overBudget = remainingBudget != null && remainingBudget < selectedType.estCost

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
        model_used: 'claude-sonnet-4-6',
        tests_total: selectedType.estTokensIn + selectedType.estTokensOut,
        tests_run: 0,
        progress_pct: 0,
        current_phase: 'queued',
      })
      .select('id')
      .single()

    if (!error && data) {
      fetch('/api/audit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scan.queued',
          detail: { scan_id: data.id, scan_type: scanType, model: 'claude-sonnet-4-6', surface_id: surfaceId },
        }),
      }).catch(() => {})
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

      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(7,11,20,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px 24px 24px', overflowY: 'auto' }}>
          <div style={{ background: '#0d1428', border: '1px solid rgba(25,118,210,0.3)', borderRadius: 16, width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

            {/* Header */}
            <div style={{ padding: '22px 28px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em', marginBottom: 2 }}>LAUNCH SCAN</h2>
                <p style={{ fontSize: 11, color: '#64748b' }}>Real HTTP probes · Claude Sonnet 4.6 analysis</p>
              </div>
              {/* Engine badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite', display: 'inline-block' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e' }}>ENGINE LIVE</span>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 28px' }}>

              {/* Target */}
              <div style={{ marginBottom: 18 }}>
                <label className="form-label">Target</label>
                {surfaces.length === 1 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(25,118,210,0.4)', background: 'rgba(25,118,210,0.08)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
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

              {/* Scan Type with live cost estimate */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>Scan Type</label>
                  <span style={{ fontSize: 10, color: '#64748b' }}>
                    Est. cost: <span style={{ color: '#42a5f5', fontFamily: 'monospace', fontWeight: 600 }}>{fmtCost(selectedType.estCost)}</span>
                    <span style={{ color: '#334155', marginLeft: 6 }}>({fmtTokens(selectedType.estTokensIn + selectedType.estTokensOut)} tokens)</span>
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SCAN_TYPES.map(t => (
                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${scanType === t.id ? 'rgba(25,118,210,0.5)' : 'rgba(255,255,255,0.06)'}`, background: scanType === t.id ? 'rgba(25,118,210,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                      <input type="radio" name="scanType" value={t.id} checked={scanType === t.id} onChange={() => setScanType(t.id)} style={{ accentColor: '#42a5f5' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{t.label}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>{t.desc}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: scanType === t.id ? '#42a5f5' : '#475569', fontWeight: 600 }}>{fmtCost(t.estCost)}</div>
                        <div style={{ fontSize: 9, color: '#334155' }}>{fmtTokens(t.estTokensIn + t.estTokensOut)}t</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Budget / engine info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Engine model</div>
                  <div style={{ fontSize: 11, color: '#3b82f6', fontFamily: 'monospace' }}>claude-sonnet-4-6</div>
                  <div style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>$3/$15 per M tokens in/out</div>
                </div>
                {remainingBudget != null ? (
                  <div style={{ padding: '8px 12px', borderRadius: 6, background: overBudget ? 'rgba(239,68,68,0.05)' : 'rgba(34,197,94,0.04)', border: `1px solid ${overBudget ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.15)'}` }}>
                    <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Monthly budget left</div>
                    <div style={{ fontSize: 11, color: overBudget ? '#ef4444' : '#22c55e', fontFamily: 'monospace', fontWeight: 600 }}>${remainingBudget.toFixed(2)}</div>
                    <div style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>of ${monthlyBudgetUsd?.toFixed(0)} / month</div>
                  </div>
                ) : (
                  <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Scan count</div>
                    <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>Unlimited</div>
                    <div style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>Enterprise plan</div>
                  </div>
                )}
              </div>

              {overBudget && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 11, color: '#ef4444' }}>
                  Monthly budget exhausted. Upgrade your plan or wait for the next billing cycle.
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 28px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={() => setOpen(false)} className="btn-s" style={{ flex: 1 }}>Cancel</button>
              <button
                onClick={handleLaunch}
                className="btn-p pulse"
                style={{ flex: 2 }}
                disabled={loading || overBudget}
              >
                {loading ? 'Queuing…' : `Launch Real Scan · ${fmtCost(selectedType.estCost)} →`}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  )
}
