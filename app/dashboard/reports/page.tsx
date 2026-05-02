import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: reports } = await supabase
    .from('compliance_reports')
    .select('*')
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
                <th>Generated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.title ?? `Report ${r.id.slice(0, 8)}`}</td>
                  <td style={{ textTransform: 'uppercase', fontSize: 11 }}>{r.framework ?? '—'}</td>
                  <td style={{ color: '#64748b', fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                  <td>
                    {r.report_url ? (
                      <a href={r.report_url} target="_blank" rel="noreferrer" className="btn-s" style={{ fontSize: 12, padding: '4px 12px' }}>
                        Download
                      </a>
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
              <p style={{ fontSize: 12, color: '#42a5f5', fontWeight: 600, marginBottom: 6 }}>DORA Art.26 TLPT Reports</p>
              <p style={{ fontSize: 12, color: '#64748b' }}>
                After each scan, Breachr auto-generates compliance reports mapped to DORA, NIS2, and HIPAA frameworks — ready to share with your regulator.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
