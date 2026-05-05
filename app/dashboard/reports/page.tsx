import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const FRAMEWORK_COLOURS: Record<string, string> = {
  'DORA':    '#1976d2',
  'NIS2':    '#7b1fa2',
  'PCI-DSS': '#c62828',
}

function SeveritySummary({ summary }: { summary: Record<string, number> | null }) {
  if (!summary) return <span style={{ color: '#475569' }}>—</span>
  const parts: string[] = []
  if (summary.critical > 0) parts.push(`${summary.critical} critical`)
  if (summary.high > 0) parts.push(`${summary.high} high`)
  if (summary.medium > 0) parts.push(`${summary.medium} medium`)
  if (summary.low > 0) parts.push(`${summary.low} low`)
  if (parts.length === 0) return <span style={{ color: '#22c55e', fontSize: 12 }}>No findings</span>
  const hasGaps = (summary.critical ?? 0) + (summary.high ?? 0) > 0
  return (
    <span style={{ fontSize: 12, color: hasGaps ? '#ef4444' : '#f59e0b' }}>
      {parts.join(' · ')}
    </span>
  )
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: reports } = await supabase
    .from('compliance_reports')
    .select('id, framework, title, status, framework_summary, generated_at, created_at, scan_id')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>REPORTS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Compliance and audit reports</p>
        </div>
      </div>

      <div className="gs au1" style={{ padding: 24 }}>
        {reports && reports.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Framework</th>
                <th>Findings</th>
                <th>Generated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r: any) => (
                <tr key={r.id}>
                  <td style={{ fontSize: 13, color: '#e2e8f0' }}>
                    {r.title ?? `Report ${r.id.slice(0, 8)}`}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                      padding: '2px 8px', borderRadius: 4,
                      background: `${FRAMEWORK_COLOURS[r.framework] ?? '#334155'}22`,
                      color: FRAMEWORK_COLOURS[r.framework] ?? '#94a3b8',
                      border: `1px solid ${FRAMEWORK_COLOURS[r.framework] ?? '#334155'}44`,
                    }}>
                      {r.framework}
                    </span>
                  </td>
                  <td>
                    <SeveritySummary summary={r.framework_summary} />
                  </td>
                  <td style={{ color: '#64748b', fontSize: 12 }}>
                    {r.generated_at
                      ? new Date(r.generated_at).toLocaleDateString('en-GB')
                      : new Date(r.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td>
                    {r.status === 'ready' ? (
                      <Link
                        href={`/dashboard/reports/${r.id}`}
                        className="btn-s"
                        style={{ fontSize: 12, padding: '4px 12px' }}
                      >
                        View Report
                      </Link>
                    ) : (
                      <span style={{ color: '#475569', fontSize: 12 }}>Generating…</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>No reports yet</p>
            <p style={{ fontSize: 13 }}>Reports are auto-generated after completed scans.</p>
            <div style={{ marginTop: 32, padding: 20, background: 'rgba(25,118,210,0.06)', borderRadius: 10, border: '1px solid rgba(25,118,210,0.2)', maxWidth: 400, margin: '32px auto 0' }}>
              <p style={{ fontSize: 12, color: '#42a5f5', fontWeight: 600, marginBottom: 6 }}>DORA · NIS2 · PCI-DSS Reports</p>
              <p style={{ fontSize: 12, color: '#64748b' }}>
                After each scan, Breachr auto-generates compliance reports mapped to your selected frameworks — ready to share with your regulator.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
