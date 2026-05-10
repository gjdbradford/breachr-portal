import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuditLogger from '@/components/AuditLogger'
import ReportDownloadButton from '@/components/ReportDownloadButton'
import { formatFriendly, formatFriendlyDate } from '@/lib/format-date'
import { resolvePermissions } from '@/lib/resolve-permissions'

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info']

const SEV_COLOURS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#22c55e',
  info:     '#64748b',
}

const FRAMEWORK_FULL_NAMES: Record<string, string> = {
  'DORA':    'Digital Operational Resilience Act (DORA)',
  'NIS2':    'Network & Information Security Directive (NIS2)',
  'PCI-DSS': 'Payment Card Industry Data Security Standard (PCI-DSS)',
}

function overallRisk(summary: Record<string, number> | null): string {
  if (!summary) return 'UNKNOWN'
  if (summary.critical > 0) return 'CRITICAL'
  if (summary.high > 0) return 'HIGH'
  if (summary.medium > 0) return 'MEDIUM'
  if (summary.low > 0) return 'LOW'
  return 'PASSED'
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) redirect('/login')

  const [{ data: tenantRow }, resolved] = await Promise.all([
    supabase.from('tenants').select('timezone').eq('id', profile.tenant_id).single(),
    resolvePermissions(user.id),
  ])
  const timezone = tenantRow?.timezone ?? 'UTC'

  const { data: report } = await supabase
    .from('compliance_reports')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!report) notFound()

  const findings: any[] = report.findings_snapshot ?? []
  const summary: Record<string, number> = report.framework_summary ?? {}
  const risk = overallRisk(summary)
  const hasGaps = (summary.critical ?? 0) + (summary.high ?? 0) > 0

  const sortedFindings = [...findings].sort((a, b) =>
    SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)
  )

  return (
    <div className="portal-content">
      {/* Fires report.viewed audit event on mount — hidden, no output */}
      <AuditLogger
        action="report.viewed"
        detail={{ report_id: report.id, framework: report.framework, scan_id: report.scan_id }}
      />

      {/* Header */}
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>
            {FRAMEWORK_FULL_NAMES[report.framework] ?? report.framework}
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {report.report_type === 'organizational'
              ? `Organisational report · generated ${report.generated_at ? formatFriendly(report.generated_at, timezone) : '—'}`
              : `Generated ${report.generated_at ? formatFriendly(report.generated_at, timezone) : '—'} · Scan ID: ${report.scan_id?.slice(0, 8) ?? '—'}`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
            padding: '4px 12px', borderRadius: 6,
            color: risk === 'PASSED' ? '#22c55e' : SEV_COLOURS[risk.toLowerCase()] ?? '#94a3b8',
            background: risk === 'PASSED' ? 'rgba(34,197,94,0.1)' : `${SEV_COLOURS[risk.toLowerCase()] ?? '#94a3b8'}18`,
            border: `1px solid ${risk === 'PASSED' ? 'rgba(34,197,94,0.3)' : `${SEV_COLOURS[risk.toLowerCase()] ?? '#94a3b8'}44`}`,
          }}>
            {risk}
          </span>
          <ReportDownloadButton reportId={report.id} framework={report.framework} canExport={resolved['reports.export']} />
        </div>
      </div>

      {/* Summary card */}
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{
          padding: 20, borderRadius: 10,
          background: hasGaps ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
          border: `1px solid ${hasGaps ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
          marginBottom: 24,
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: hasGaps ? '#ef4444' : '#22c55e', marginBottom: 12, letterSpacing: '0.05em' }}>
            {hasGaps ? 'GAPS FOUND — Immediate action required' : 'PASSED — No critical or high severity gaps identified'}
          </p>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {SEV_ORDER.filter(s => s !== 'info').map(sev => (
              <div key={sev}>
                <span style={{ fontSize: 22, fontWeight: 700, color: SEV_COLOURS[sev] }}>{summary[sev] ?? 0}</span>
                <span style={{ fontSize: 12, color: '#64748b', marginLeft: 6, textTransform: 'capitalize' }}>{sev}</span>
              </div>
            ))}
          </div>
          {report.sha256_hash && (
            <p style={{ fontSize: 11, color: '#334155', marginTop: 16, fontFamily: 'monospace' }}>
              SHA-256: {report.sha256_hash}
            </p>
          )}
        </div>

        {/* Scope section — org reports only */}
        {report.report_type === 'organizational' && (() => {
          const targetsCovered: Array<{ id: string; name: string }> =
            Array.isArray(report.targets_covered) ? report.targets_covered : []
          return (
            <div style={{
              padding: 16, borderRadius: 8,
              background: 'rgba(25,118,210,0.06)', border: '1px solid rgba(25,118,210,0.15)',
              marginBottom: 24,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Report Scope
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Reporting Period</p>
                  <p style={{ fontSize: 12, color: '#e2e8f0' }}>
                    {report.report_period_start ? formatFriendlyDate(report.report_period_start, timezone) : '—'}
                    {' → '}
                    {report.report_period_end ? formatFriendlyDate(report.report_period_end, timezone) : '—'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Scans Included</p>
                  <p style={{ fontSize: 12, color: '#e2e8f0' }}>{report.scan_count ?? (report.scan_ids?.length ?? '—')}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Targets Assessed</p>
                  <p style={{ fontSize: 12, color: '#e2e8f0' }}>{targetsCovered.length}</p>
                </div>
              </div>
              {targetsCovered.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>Covered Targets</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {targetsCovered.map(t => (
                      <span key={t.id} style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 4,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        color: '#94a3b8',
                      }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Findings table */}
        {sortedFindings.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Severity</th>
                <th>Finding</th>
                <th>OWASP</th>
                <th>Controls</th>
              </tr>
            </thead>
            <tbody>
              {sortedFindings.map((f: any, i: number) => (
                <tr key={i}>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: SEV_COLOURS[f.severity] ?? '#94a3b8',
                    }}>
                      {f.severity}
                    </span>
                  </td>
                  <td>
                    <p style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>{f.title}</p>
                    <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{f.description}</p>
                  </td>
                  <td style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {f.owasp_category || '—'}
                  </td>
                  <td>
                    {(f.controls ?? []).map((c: string) => (
                      <span key={c} style={{
                        display: 'inline-block', fontSize: 11, fontWeight: 600,
                        padding: '2px 6px', borderRadius: 4, marginRight: 4, marginBottom: 4,
                        background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}>
                        {c}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569', fontSize: 14 }}>
            No findings — all probes passed
          </div>
        )}
      </div>
    </div>
  )
}
