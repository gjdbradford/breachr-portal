import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { DORA_ARTICLES } from '@/lib/types'
import LaunchScanButton from '@/components/LaunchScanButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')
  const tenantId = profile.tenant_id

  const { data: tenant } = await supabase
    .from('tenants').select('name, onboarding_complete, plan, industry').eq('id', tenantId).single()
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
  // Coverage score — penalise open criticals heavily
  const coverageScore = hasScans
    ? Math.max(0, Math.min(100, 100 - (criticals * 15) - (open * 3)))
    : 0

  // DORA article scores derived from real data
  const doraScores = [
    // Art. 5-10: ICT Risk Management — have you tested + addressed findings?
    hasScans ? Math.round(50 + remediatedRatio * 30 + (surfaceCount > 0 ? 10 : 0) + (criticals === 0 ? 10 : 0)) : 0,
    // Art. 17: Incident Management — are criticals being addressed?
    hasScans ? Math.round(80 - (criticals * 12)) : 0,
    // Art. 24: General ICT Testing — number of completed scans
    Math.min(100, (completedScans ?? 0) * 25),
    // Art. 25: Advanced Testing — TLPT scans done?
    Math.min(100, tlpt * 50),
    // Art. 26: TIBER-EU — only if explicit TLPT exercise completed
    tlpt > 0 ? 60 : 0,
    // Art. 28-30: Third-party risk — surfaces tested
    Math.min(100, surfaceCount * 30 + (hasScans ? 40 : 0)),
  ].map(s => Math.max(0, Math.min(100, Math.round(s))))

  const doraScore = Math.round(doraScores.reduce((a, b) => a + b, 0) / doraScores.length)
  const signedRatio = auditEvents ? Math.round(((auditSigned ?? 0) / auditEvents) * 100) : 0

  const circumference = 2 * Math.PI * 40
  const dashArr = Math.round((doraScore / 100) * circumference)

  return (
    <div className="portal-content">
      {/* Header */}
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>
            Compliance Dashboard
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{tenant?.name ?? 'Security Dashboard'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, padding: '5px 10px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            Audit trail live · EU only
          </div>
          {surfaces && surfaces.length > 0 && (
            <LaunchScanButton surfaces={surfaces} tenantId={tenantId} />
          )}
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <MetricCard accent="#22c55e" label="DORA Compliance Score" value={`${doraScore}`} suffix="/100"
          sub={doraScore >= 80 ? 'Compliant posture' : doraScore >= 50 ? 'Partial — action needed' : hasScans ? 'Critical findings open' : 'Run first scan to assess'} />
        <MetricCard accent="#ef4444" label="Critical Findings Open" value={String(criticals)}
          sub={criticals > 0 ? 'Board notification required' : 'No critical issues'} />
        <MetricCard accent="#f59e0b" label="Scans" value={String(completedScans ?? 0)}
          sub={`${activeScans ?? 0} running · ${completedScans ?? 0} complete`} />
        <MetricCard accent="#3b82f6" label="Audit Events" value={String(auditEvents ?? 0)}
          sub={auditEvents ? `${signedRatio}% cryptographically signed` : 'Launch a scan to start'} />
      </div>

      {/* Main two-column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* DORA article table */}
        <div className="gs au1" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>DORA Article Compliance Status</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>Based on scan history</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Requirement</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {DORA_ARTICLES.map((art, i) => {
                const score = doraScores[i] ?? 0
                const status = !hasScans && score === 0 ? 'pending'
                  : score >= 80 ? 'compliant'
                  : score >= 50 ? 'partial'
                  : score > 0   ? 'fail'
                  : 'pending'
                return (
                  <tr key={art.ref}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b' }}>{art.ref}</span></td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 12 }}>{art.name}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{art.desc}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${score}%`, borderRadius: 2, background: score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b', minWidth: 28 }}>{score > 0 ? `${score}%` : '—'}</span>
                      </div>
                    </td>
                    <td><DoraStatusPill status={status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Right column: score ring + quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="gs au1" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Overall DORA Posture</p>
            <div style={{ position: 'relative', width: 100, height: 100 }}>
              <svg viewBox="0 0 100 100" width="100" height="100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none"
                  stroke={doraScore >= 80 ? '#22c55e' : doraScore >= 50 ? '#f59e0b' : doraScore > 0 ? '#ef4444' : '#334155'}
                  strokeWidth="8"
                  strokeDasharray={`${dashArr} ${circumference}`} strokeDashoffset="63"
                  strokeLinecap="round" transform="rotate(-90 50 50)" />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: doraScore >= 80 ? '#22c55e' : doraScore >= 50 ? '#f59e0b' : '#42a5f5', lineHeight: 1 }}>{doraScore}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>/100</div>
              </div>
            </div>
            <div style={{ width: '100%' }}>
              {[
                { label: 'Audit coverage', val: `${signedRatio}%`, ok: signedRatio === 100 },
                { label: 'Findings remediated', val: total > 0 ? `${Math.round(remediatedRatio * 100)}%` : '—', ok: remediatedRatio > 0.7 },
                { label: 'TLPT completion', val: tlpt > 0 ? `${tlpt} exercise${tlpt > 1 ? 's' : ''}` : 'None', ok: tlpt > 0 },
                { label: 'Data isolation', val: 'EU ✓', ok: true },
                { label: 'Surfaces tested', val: surfaceCount > 0 ? String(surfaceCount) : '—', ok: surfaceCount > 0 },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                  <span style={{ color: '#64748b' }}>{row.label}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: row.ok ? '#22c55e' : '#f59e0b' }}>{row.val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="gs au1" style={{ padding: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>Quick Actions</p>
            {[
              { icon: '📄', name: 'Export BaFin evidence pack', sub: 'Art. 24/25 · cryptographic proof · PDF', href: '/dashboard/reports' },
              { icon: '⚔️', name: 'Schedule TLPT exercise', sub: 'TIBER-EU · Art. 26 · CREST team', href: '/dashboard/scans' },
              { icon: '⛓', name: 'View audit chain', sub: `${auditEvents ?? 0} signed entries · 2yr retention`, href: '/dashboard/audit' },
            ].map(a => (
              <Link key={a.name} href={a.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', marginBottom: 6, textDecoration: 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(25,118,210,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{a.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#e2e8f0' }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{a.sub}</div>
                </div>
                <span style={{ color: '#64748b', fontSize: 12 }}>›</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: findings + audit trail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                      {f.finding_hash && <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#3b5f8a', display: 'block', marginTop: 1 }} title={f.finding_hash}>{f.finding_hash.slice(0, 16)}…</span>}
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
                ? <LaunchScanButton surfaces={surfaces} tenantId={tenantId} />
                : <Link href="/onboarding" className="btn-p" style={{ fontSize: 12, padding: '7px 16px' }}>Add Target →</Link>}
            </div>
          )}
        </div>

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

function MetricCard({ label, value, suffix = '', sub, accent }: { label: string; value: string; suffix?: string; sub: string; accent: string }) {
  return (
    <div style={{ background: 'rgba(13,20,40,0.65)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</p>
      <p className="font-display" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: accent }}>
        {value}<span style={{ fontSize: 14 }}>{suffix}</span>
      </p>
      <p style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>{sub}</p>
    </div>
  )
}

function DoraStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    compliant: { label: '✓ Compliant',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.2)' },
    partial:   { label: '⚠ Partial',      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
    fail:      { label: '✗ Non-compliant', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)' },
    pending:   { label: '○ Not assessed',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
  }
  const s = map[status] ?? map.pending
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 4, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', padding: '3px 7px', whiteSpace: 'nowrap', color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  )
}

function AuditRow({ log }: { log: any }) {
  const actionColors: Record<string, string> = {
    'scan.queued': '#3b82f6', 'scan.started': '#42a5f5',
    'finding.discovered': '#f59e0b', 'finding.verified_fixed': '#22c55e', 'scan.completed': '#22c55e',
  }
  const color = actionColors[log.action] ?? '#64748b'
  let detail = ''
  try {
    const parsed = JSON.parse(log.detail ?? '{}')
    // Show the most useful field without the internal _ts
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
