import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import LaunchScanButton from '@/components/LaunchScanButton'
import { resolvePermissions } from '@/lib/resolve-permissions'
import { FRAMEWORKS, computeFrameworkScore } from '@/lib/frameworks'
import type { FrameworkScoreInputs } from '@/lib/frameworks'
import { computeExposureScore } from '@/lib/exposure-score'
import KpiGrid from '@/components/dashboard/KpiGrid'
import ExposureGauge from '@/components/dashboard/ExposureGauge'
import AiEnginePanel from '@/components/dashboard/AiEnginePanel'
import FrameworkAccordion from '@/components/dashboard/FrameworkAccordion'
import TargetsCard from '@/components/dashboard/TargetsCard'
import type { TargetTypeSummary } from '@/components/dashboard/TargetsCard'
import InventoryMiniCard from '@/components/dashboard/InventoryMiniCard'
import SensorsMiniCard from '@/components/dashboard/SensorsMiniCard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) redirect('/login')
  const tenantId = profile.tenant_id

  const { data: tenant } = await supabase
    .from('tenants').select('name, onboarding_complete, plan, industry, scans_this_month, tokens_used_this_month, compliance_frameworks, node_count, ai_model_override, data_region').eq('id', tenantId).single()
  if (tenant && !tenant.onboarding_complete) redirect('/onboarding')

  const [
    { count: activeScans },
    { count: completedScans },
    { count: criticalOpen },
    { count: totalOpen },
    { count: totalFindings },
    { count: remediatedFindings },
    { count: tlptScans },
    { count: auditEvents },
    { count: auditSigned },
    { data: recentFindings },
    { data: recentAudit },
    { data: surfaces },
    resolved,
    // New queries for dashboard redesign
    { data: allSurfaces },
    { data: findingsPerSurface },
    { data: sensors },
    { count: inventoryTotal },
    { count: inventoryUnreviewed },
    { count: inventoryServers },
    { count: inventoryServices },
  ] = await Promise.all([
    supabase.from('scans').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'running'),
    supabase.from('scans').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'complete'),
    supabase.from('findings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('severity', 'critical').in('status', ['open', 'in_progress']),
    supabase.from('findings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['open', 'in_progress']),
    supabase.from('findings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('findings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['remediated', 'verified_fixed']),
    supabase.from('scans').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('scan_type', 'tlpt').eq('status', 'complete'),
    supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).not('signature', 'is', null),
    supabase.from('findings').select('id,title,severity,ai_model,ai_confidence,finding_hash,owasp_category,cvss_score,status,created_at,scan_id').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5),
    supabase.from('audit_logs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(6),
    supabase.from('attack_surfaces').select('id,name,target_url').eq('tenant_id', tenantId).eq('active', true),
    resolvePermissions(user.id),
    supabase.from('attack_surfaces').select('id,target_type').eq('tenant_id', tenantId).eq('active', true),
    supabase.from('findings').select('attack_surface_id,severity').eq('tenant_id', tenantId).in('status', ['open', 'in_progress']),
    supabase.from('sensors').select('id,name,status,location').eq('tenant_id', tenantId).order('name'),
    supabase.from('assets').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('assets').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true).is('acknowledged_at', null),
    supabase.from('assets').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true).eq('asset_type', 'server'),
    supabase.from('assets').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true).eq('asset_type', 'service'),
  ])

  const hasScans = (completedScans ?? 0) > 0
  const total = totalFindings ?? 0
  const remediated = remediatedFindings ?? 0
  const open = totalOpen ?? 0
  const criticals = criticalOpen ?? 0
  const tlpt = tlptScans ?? 0
  const surfaceCount = surfaces?.length ?? 0

  // Remediation ratio (what % of all findings have been fixed)
  const remediatedRatio = total > 0 ? remediated / total : 0

  const signedRatio = auditEvents ? Math.round(((auditSigned ?? 0) / auditEvents) * 100) : 0

  const activeFrameworks: string[] = (tenant?.compliance_frameworks ?? []) as string[]
  const nodeCount = tenant?.node_count ?? 1
  const dataRegion = tenant?.data_region ?? 'eu'
  const activeModel = tenant?.ai_model_override ?? null

  // Build framework score inputs
  const fwInputs: FrameworkScoreInputs = {
    hasScans,
    completedScans: completedScans ?? 0,
    criticals,
    highs: 0,
    open,
    total,
    remediated,
    tlpt: tlpt ?? 0,
    surfaceCount,
    auditEvents: auditEvents ?? 0,
    auditSignedRatio: auditEvents ? (auditSigned ?? 0) / auditEvents : 0,
    remediatedRatio,
  }

  // Compute per-framework scores for active frameworks only
  const frameworkScores = FRAMEWORKS
    .filter(f => activeFrameworks.includes(f.id))
    .map(f => computeFrameworkScore(f, fwInputs))

  // Weighted exposure score
  const avgComplianceScore = frameworkScores.length > 0
    ? frameworkScores.reduce((sum, f) => sum + f.overall, 0) / frameworkScores.length
    : 0
  const findingsScore = Math.max(0, Math.min(100, 100 - criticals * 15 - open * 3))
  const coverageScore = hasScans ? Math.min(100, (completedScans ?? 0) * 12 + surfaceCount * 8) : 0
  const auditIntegrityScore = signedRatio

  const exposureDimensions = [
    { label: 'Compliance',   weight: 0.35, score: Math.round(avgComplianceScore) },
    { label: 'Findings',     weight: 0.30, score: findingsScore },
    { label: 'Coverage',     weight: 0.20, score: coverageScore },
    { label: 'Audit',        weight: 0.15, score: auditIntegrityScore },
  ]
  const exposureScore = computeExposureScore(exposureDimensions)

  // Build targets-by-type summary
  type FindingRow = { attack_surface_id: string | null; severity: string }
  const findingsBySurface: Record<string, FindingRow[]> = {}
  for (const f of findingsPerSurface ?? []) {
    const sid = f.attack_surface_id ?? '__none__'
    findingsBySurface[sid] = [...(findingsBySurface[sid] ?? []), f]
  }

  type SurfaceRow = { id: string; target_type: string }
  const typeMap: Record<string, { count: number; cleanCount: number; findingsCount: number; criticalCount: number }> = {}
  for (const s of (allSurfaces ?? []) as SurfaceRow[]) {
    const t = s.target_type ?? 'other'
    if (!typeMap[t]) typeMap[t] = { count: 0, cleanCount: 0, findingsCount: 0, criticalCount: 0 }
    typeMap[t].count++
    const sFindings = findingsBySurface[s.id] ?? []
    if (sFindings.length === 0) {
      typeMap[t].cleanCount++
    } else {
      typeMap[t].findingsCount++
      if (sFindings.some(f => f.severity === 'critical')) typeMap[t].criticalCount++
    }
  }
  const targetSummaries: TargetTypeSummary[] = Object.entries(typeMap).map(([type, counts]) => ({ type, ...counts }))

  return (
    <div className="portal-content">

      {/* Header */}
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Compliance Dashboard
          </h1>
          <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
            {tenant?.name ?? 'Security Dashboard'} · {activeFrameworks.length} framework{activeFrameworks.length !== 1 ? 's' : ''} active
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, padding: '5px 10px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            Audit trail live
          </div>
          <div style={{ fontSize: 11, color: '#42a5f5', background: 'rgba(66,165,245,0.08)', border: '1px solid rgba(66,165,245,0.2)', borderRadius: 6, padding: '5px 10px' }}>
            {dataRegion === 'africa' ? '🌍 Africa · Cape Town' : '🇪🇺 EU · Frankfurt'}
          </div>
          {surfaces && surfaces.length > 0 && (
            <LaunchScanButton
              surfaces={surfaces}
              tenantId={tenantId}
              planId={tenant?.plan ?? 'free'}
              scansThisMonth={tenant?.scans_this_month ?? 0}
              tokensThisMonth={tenant?.tokens_used_this_month ?? 0}
              canCreate={resolved['scans.create']}
            />
          )}
        </div>
      </div>

      {/* ── Hero row: Exposure gauge + KPI grid + AI Engine panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 200px', gap: 14, marginBottom: 16 }}>

        <ExposureGauge score={exposureScore} dimensions={exposureDimensions} />

        <KpiGrid tiles={[
          { label: 'Critical Findings',   value: String(criticals),               accent: '#ef4444', borderColor: 'rgba(239,68,68,0.15)',   sub: criticals > 0 ? 'Board notification required' : 'No critical issues' },
          { label: 'Total Open Findings', value: String(open),                    accent: '#f59e0b', borderColor: 'rgba(245,158,11,0.15)',   sub: `${open - criticals} non-critical open` },
          { label: 'Scans',               value: String(completedScans ?? 0),     accent: '#3b82f6', borderColor: 'rgba(59,130,246,0.15)',   sub: `${activeScans ?? 0} running · ${completedScans ?? 0} complete` },
          { label: 'Audit Events',        value: String(auditEvents ?? 0),        accent: '#22c55e', borderColor: 'rgba(34,197,94,0.15)',    sub: auditEvents ? `${signedRatio}% cryptographically signed` : 'Launch a scan to start' },
          { label: 'Target Surfaces',     value: String(surfaceCount),            accent: '#64748b', borderColor: 'rgba(100,116,139,0.15)',  sub: targetSummaries.map(t => `${t.count} ${t.type}`).join(' · ') || 'No targets yet' },
          { label: 'Inventory Assets',    value: String(inventoryTotal ?? 0),     accent: '#14b8a6', borderColor: 'rgba(20,184,166,0.15)',   sub: (inventoryUnreviewed ?? 0) > 0 ? `${inventoryUnreviewed} unreviewed` : 'All reviewed' },
        ]} />

        <AiEnginePanel
          planId={tenant?.plan ?? 'free'}
          activeModel={activeModel}
          nodeCount={nodeCount}
          dataRegion={dataRegion}
        />
      </div>

      {/* ── Compliance + right panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, marginBottom: 16 }}>

        <FrameworkAccordion
          activeFrameworks={activeFrameworks}
          scores={frameworkScores}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <TargetsCard summaries={targetSummaries} totalCount={surfaceCount} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <InventoryMiniCard
              total={inventoryTotal ?? 0}
              servers={inventoryServers ?? 0}
              services={inventoryServices ?? 0}
              unreviewed={inventoryUnreviewed ?? 0}
            />
            <SensorsMiniCard sensors={sensors ?? []} />
          </div>
        </div>
      </div>

      {/* ── Bottom row: findings + audit ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Recent findings */}
        <div className="gs au1" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
              Recent Findings
              {total > 0 && <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 6 }}>({total} total)</span>}
            </span>
            <Link href="/dashboard/findings" style={{ fontSize: 10, color: '#42a5f5' }}>View all →</Link>
          </div>
          {recentFindings && recentFindings.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Sev</th>
                  <th>CVSS</th>
                  <th>AI Model</th>
                </tr>
              </thead>
              <tbody>
                {recentFindings.map((f: any) => (
                  <tr key={f.id}>
                    <td style={{ maxWidth: 200 }}>
                      <div style={{ fontWeight: 500, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</div>
                      {f.finding_hash && <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#3b5f8a', display: 'block', marginTop: 1 }}>{f.finding_hash.slice(0, 16)}…</span>}
                    </td>
                    <td><span className={`sev-${f.severity}`} style={{ borderRadius: 3, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 6px' }}>{f.severity}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{f.cvss_score ?? '—'}</td>
                    <td>
                      {f.ai_model ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 3, fontSize: 9, color: '#3b82f6', padding: '2px 5px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {f.ai_model.split(' ')[0]}
                          {f.ai_confidence && <span style={{ color: '#22c55e', marginLeft: 3, fontWeight: 600 }}>{f.ai_confidence}%</span>}
                        </span>
                      ) : <span style={{ color: '#475569', fontSize: 10 }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569' }}>
              <p style={{ marginBottom: 12, fontSize: 13 }}>No findings yet — run a scan to start.</p>
              {surfaces && surfaces.length > 0
                ? <LaunchScanButton surfaces={surfaces} tenantId={tenantId} canCreate={resolved['scans.create']} />
                : <Link href="/onboarding" className="btn-p" style={{ fontSize: 12, padding: '7px 16px' }}>Add Target →</Link>}
            </div>
          )}
        </div>

        {/* Cryptographic audit trail */}
        <div className="gs au1" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Cryptographic Audit Trail</span>
            <Link href="/dashboard/audit" style={{ fontSize: 10, color: '#22c55e' }}>
              {auditSigned === auditEvents && auditEvents ? '✓ 100% signed' : `${signedRatio}% signed`} →
            </Link>
          </div>
          {recentAudit && recentAudit.length > 0 ? (
            <div>
              {recentAudit.map((log: any) => (
                <AuditRow key={log.id} log={log} />
              ))}
            </div>
          ) : (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569' }}>
              <p style={{ fontSize: 13 }}>Audit events will appear here as you use the platform.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

// ── AuditRow helper ────────────────────────────

function AuditRow({ log }: { log: any }) {
  const actionColors: Record<string, string> = {
    'scan.queued': '#3b82f6', 'scan.started': '#42a5f5',
    'finding.discovered': '#f59e0b', 'finding.verified_fixed': '#22c55e', 'scan.completed': '#22c55e',
  }
  const color = actionColors[log.action] ?? '#64748b'
  let detail = ''
  try {
    const parsed = JSON.parse(log.detail ?? '{}')
    const { _ts, scan_id, finding_id, ...rest } = parsed
    const key = Object.keys(rest)[0]
    detail = key ? `${key}: ${String(rest[key]).slice(0, 40)}` : ''
  } catch { detail = String(log.detail ?? '').slice(0, 60) }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#475569', minWidth: 72, flexShrink: 0, paddingTop: 2 }}>
        {new Date(log.created_at).toISOString().slice(11, 19)}Z
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700, fontFamily: 'monospace', background: `${color}18`, border: `1px solid ${color}40`, color, whiteSpace: 'nowrap' }}>
            {log.action}
          </span>
        </div>
        {detail && <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>}
        {log.signature && <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#3b5f8a', marginTop: 2 }}>{log.signature.slice(0, 20)}…</div>}
      </div>
    </div>
  )
}
