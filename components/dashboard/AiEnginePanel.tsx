// components/dashboard/AiEnginePanel.tsx
import { PLAN_TIER, TIER_CONFIG } from '@/lib/plans'
import type { PlanId } from '@/lib/plans'

interface AiEnginePanelProps {
  planId: string
  activeModel: string | null
  nodeCount: number
  dataRegion: string
}

export default function AiEnginePanel({ planId, activeModel, nodeCount, dataRegion }: AiEnginePanelProps) {
  const tier = PLAN_TIER[(planId as PlanId) ?? 'free'] ?? 'bronze'
  const config = TIER_CONFIG[tier]
  const isAfrica = dataRegion === 'africa'

  return (
    <div style={{ background: 'rgba(13,20,40,0.9)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#a78bfa,#818cf8)' }} />

      {/* Tier */}
      <div>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>AI Engine</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            {config.badge}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>{config.label} Tier</div>
            <div style={{ fontSize: 10, color: '#7c6fcd' }}>{config.modelClass}</div>
          </div>
        </div>
      </div>

      {/* Active model */}
      <div>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Active Model</p>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8', background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 4, padding: '3px 7px', display: 'inline-block' }}>
          {activeModel ?? 'claude-haiku-4-5'}
        </span>
        <div style={{ marginTop: 6 }}>
          {config.byoModel ? (
            <a href="/dashboard/settings?tab=ai" style={{ display: 'block', fontSize: 9, color: '#a78bfa', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 4, padding: '4px 8px', textDecoration: 'none', textAlign: 'center' }}>
              ⚙ Switch / BYO Model →
            </a>
          ) : (
            <div title="Available on Enterprise" style={{ fontSize: 9, color: '#475569', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '4px 8px', textAlign: 'center', cursor: 'default' }}>
              ⚙ Switch model — Enterprise only
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Nodes */}
      <div>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Scan Nodes</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {Array.from({ length: config.maxNodes }).map((_, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < nodeCount ? '#22c55e' : '#334155', boxShadow: i < nodeCount ? '0 0 4px rgba(34,197,94,0.5)' : 'none' }} title={i < nodeCount ? `Node ${i + 1} active` : 'Inactive'} />
          ))}
          <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 600, marginLeft: 4 }}>{nodeCount} active</span>
        </div>
        {tier !== 'platinum' && (
          <p style={{ fontSize: 9, color: '#475569', marginTop: 3 }}>More nodes available on Enterprise</p>
        )}
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Data residency */}
      <div>
        <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Data Residency</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13 }}>{isAfrica ? '🌍' : '🇪🇺'}</span>
          <span style={{ fontSize: 10, color: '#64748b' }}>{isAfrica ? 'Africa · Cape Town' : 'EU · Frankfurt'}</span>
          <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>{isAfrica ? '✓ POPIA' : '✓ GDPR'}</span>
        </div>
        {!isAfrica && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.45 }}>
            <span style={{ fontSize: 13 }}>🌍</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>Africa · Cape Town (add-on)</span>
          </div>
        )}
      </div>
    </div>
  )
}
