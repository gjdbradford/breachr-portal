'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { getPlan, fmtTokens, type PlanId } from '@/lib/plans'
import UpgradeWallModal from '@/components/UpgradeWallModal'

interface Surface { id: string; name: string; target_url: string }

// Cost model: Claude Sonnet 4.6 pricing
// Input: $3.00/M tokens  |  Output: $15.00/M tokens
const ALL_SCAN_TYPES = [
  {
    id: 'full',
    label: 'Full Scan',
    desc: 'OWASP Top 10 + custom rules',
    estTokensIn: 20000,
    estTokensOut: 4000,
    estCost: 0.12,
    plans: ['free', 'professional', 'enterprise'],
  },
  {
    id: 'api',
    label: 'API Scan',
    desc: 'REST/GraphQL endpoint fuzzing',
    estTokensIn: 12000,
    estTokensOut: 2500,
    estCost: 0.07,
    plans: ['professional', 'enterprise'],
  },
  {
    id: 'tlpt',
    label: 'TLPT Exercise',
    desc: 'DORA Art. 26 threat-led',
    estTokensIn: 32000,
    estTokensOut: 6000,
    estCost: 0.19,
    plans: ['enterprise'],
  },
]

function fmtCost(usd: number) {
  return usd < 0.01 ? '<$0.01' : `~$${usd.toFixed(2)}`
}

export default function LaunchScanButton({
  surfaces,
  tenantId,
  planId,
  scansThisMonth,
  tokensThisMonth,
  canCreate,
}: {
  surfaces: Surface[]
  tenantId: string
  planId?: string
  scansThisMonth?: number
  tokensThisMonth?: number
  canCreate?: boolean
}) {
  if (canCreate === false) return null
  const [open, setOpen] = useState(false)
  const [showUpgradeWall, setShowUpgradeWall] = useState(false)
  const [surfaceId, setSurfaceId] = useState(surfaces[0]?.id ?? '')
  const [scanType, setScanType] = useState('full')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const plan = getPlan(planId)

  // Filter scan types to what this plan allows
  const availableScanTypes = ALL_SCAN_TYPES.filter(t => plan.scanTypes.includes(t.id))
  const selectedType = availableScanTypes.find(t => t.id === scanType) ?? availableScanTypes[0]

  // Enforce scan count limit
  const scansUsed = scansThisMonth ?? 0
  const scansLimit = plan.scansPerMonth
  const overScanLimit = scansLimit !== null && scansUsed >= scansLimit
  const scansRemaining = scansLimit !== null ? Math.max(0, scansLimit - scansUsed) : null

  // Enforce token budget
  const tokensUsed = tokensThisMonth ?? 0
  const tokensLimit = plan.tokensPerMonth
  const estTokensNeeded = (selectedType?.estTokensIn ?? 0) + (selectedType?.estTokensOut ?? 0)
  const overTokenLimit = tokensLimit !== null && (tokensUsed + estTokensNeeded) > tokensLimit
  const tokensRemaining = tokensLimit !== null ? Math.max(0, tokensLimit - tokensUsed) : null

  const blocked = overScanLimit || overTokenLimit

  function openModal() {
    if (blocked) { setShowUpgradeWall(true); return }
    if (!plan.scanTypes.includes(scanType) && availableScanTypes[0]) {
      setScanType(availableScanTypes[0].id)
    }
    setOpen(true)
  }

  async function handleLaunch() {
    setLoading(true)
    const res = await fetch('/api/scans/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attack_surface_id: surfaceId, scan_type: scanType }),
    })
    const json = await res.json()

    if (res.status === 429) {
      // Server confirmed limit hit — show upgrade wall
      setLoading(false)
      setOpen(false)
      setShowUpgradeWall(true)
      return
    }

    if (!res.ok) {
      setLoading(false)
      return
    }

    fetch('/api/audit/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'scan.queued',
        detail: { scan_id: json.scanId, scan_type: scanType, model: 'claude-sonnet-4-6', surface_id: surfaceId },
      }),
    }).catch(() => {})
    setOpen(false)
    router.push(`/dashboard/scans/${json.scanId}`)
  }

  const upgradeReason = overScanLimit ? 'scan_limit' : 'token_limit'

  return (
    <>
      <button onClick={openModal} className="btn-p" style={{ fontSize: 13, padding: '8px 18px' }}>
        + Launch Scan
      </button>

      {showUpgradeWall && (
        <UpgradeWallModal
          reason={upgradeReason}
          currentPlanId={planId ?? 'free'}
          scansUsed={scansUsed}
          scansLimit={scansLimit}
          tokensUsed={tokensUsed}
          tokensLimit={tokensLimit}
          onClose={() => setShowUpgradeWall(false)}
        />
      )}

      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(7,11,20,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px 24px 24px', overflowY: 'auto' }}>
          <div style={{ background: '#0d1428', border: '1px solid rgba(25,118,210,0.3)', borderRadius: 16, width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

            {/* Header */}
            <div style={{ padding: '22px 28px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em', marginBottom: 2 }}>LAUNCH SCAN</h2>
                <p style={{ fontSize: 11, color: '#64748b' }}>Real HTTP probes · Claude Sonnet 4.6 analysis</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                {/* Plan badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 5, background: `${plan.color}12`, border: `1px solid ${plan.color}40` }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: plan.color, display: 'inline-block' }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: plan.color, letterSpacing: '0.08em' }}>{plan.label.toUpperCase()}</span>
                </div>
                {/* Engine badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 5, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite', display: 'inline-block' }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#22c55e' }}>ENGINE LIVE</span>
                </div>
              </div>
            </div>

            {/* Plan usage meters */}
            <div style={{ padding: '12px 28px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {/* Scans meter */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Scans this month</span>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: overScanLimit ? '#ef4444' : '#64748b' }}>
                    {scansUsed}{scansLimit !== null ? ` / ${scansLimit}` : ' / ∞'}
                  </span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: scansLimit ? `${Math.min(100, (scansUsed / scansLimit) * 100)}%` : '10%', background: overScanLimit ? '#ef4444' : '#42a5f5', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
                {scansRemaining !== null && (
                  <p style={{ fontSize: 9, color: overScanLimit ? '#ef4444' : '#64748b', marginTop: 2 }}>
                    {overScanLimit ? 'Limit reached' : `${scansRemaining} remaining`}
                  </p>
                )}
              </div>
              {/* Tokens meter */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tokens this month</span>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: overTokenLimit ? '#ef4444' : '#64748b' }}>
                    {fmtTokens(tokensUsed)}{tokensLimit !== null ? ` / ${fmtTokens(tokensLimit)}` : ' / ∞'}
                  </span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: tokensLimit ? `${Math.min(100, (tokensUsed / tokensLimit) * 100)}%` : '10%', background: overTokenLimit ? '#ef4444' : '#a78bfa', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
                {tokensRemaining !== null && (
                  <p style={{ fontSize: 9, color: overTokenLimit ? '#ef4444' : '#64748b', marginTop: 2 }}>
                    {overTokenLimit ? 'Insufficient tokens' : `${fmtTokens(tokensRemaining)} remaining`}
                  </p>
                )}
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

              {/* Scan Type */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>Scan Type</label>
                  {selectedType && (
                    <span style={{ fontSize: 10, color: '#64748b' }}>
                      Est. cost: <span style={{ color: '#42a5f5', fontFamily: 'monospace', fontWeight: 600 }}>{fmtCost(selectedType.estCost)}</span>
                      <span style={{ color: '#334155', marginLeft: 6 }}>({fmtTokens(selectedType.estTokensIn + selectedType.estTokensOut)} tokens)</span>
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ALL_SCAN_TYPES.map(t => {
                    const allowed = plan.scanTypes.includes(t.id)
                    const isSelected = scanType === t.id
                    return (
                      <label
                        key={t.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${isSelected ? 'rgba(25,118,210,0.5)' : 'rgba(255,255,255,0.06)'}`, background: isSelected ? 'rgba(25,118,210,0.08)' : 'rgba(255,255,255,0.02)', cursor: allowed ? 'pointer' : 'default', opacity: allowed ? 1 : 0.4 }}
                      >
                        <input type="radio" name="scanType" value={t.id} checked={isSelected} onChange={() => allowed && setScanType(t.id)} disabled={!allowed} style={{ accentColor: '#42a5f5' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {t.label}
                            {!allowed && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}>
                                {t.id === 'tlpt' ? 'Enterprise' : 'Professional+'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{t.desc}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: isSelected ? '#42a5f5' : '#475569', fontWeight: 600 }}>{fmtCost(t.estCost)}</div>
                          <div style={{ fontSize: 9, color: '#334155' }}>{fmtTokens(t.estTokensIn + t.estTokensOut)}t</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Engine info */}
              <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Engine model</div>
                <div style={{ fontSize: 11, color: '#3b82f6', fontFamily: 'monospace' }}>claude-sonnet-4-6</div>
                <div style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>$3/$15 per M tokens in/out</div>
              </div>

              {/* Limit warnings */}
              {overScanLimit && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>Monthly scan limit reached ({scansUsed}/{scansLimit})</div>
                    <div style={{ fontSize: 11, color: '#f87171' }}>Upgrade to {plan.id === 'free' ? 'Professional (50 scans/mo)' : 'Enterprise (unlimited)'} or wait for your plan to reset.</div>
                  </div>
                </div>
              )}
              {overTokenLimit && !overScanLimit && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>Token budget insufficient</div>
                    <div style={{ fontSize: 11, color: '#f87171' }}>This scan needs ~{fmtTokens(estTokensNeeded)} tokens but only {fmtTokens(tokensRemaining ?? 0)} remain. Upgrade or buy extra tokens ({plan.extraTokenPrice}).</div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 28px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={() => setOpen(false)} className="btn-s" style={{ flex: 1 }}>Cancel</button>
              {blocked ? (
                <button
                  onClick={() => { setOpen(false); setShowUpgradeWall(true) }}
                  className="btn-p"
                  style={{ flex: 2 }}
                >
                  Upgrade Plan →
                </button>
              ) : (
                <button
                  onClick={handleLaunch}
                  className="btn-p pulse"
                  style={{ flex: 2 }}
                  disabled={loading}
                >
                  {loading ? 'Queuing…' : `Launch Real Scan · ${selectedType ? fmtCost(selectedType.estCost) : ''} →`}
                </button>
              )}
            </div>
          </div>
        </div>
      , document.body)}
    </>
  )
}
