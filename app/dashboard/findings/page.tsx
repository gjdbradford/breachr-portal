import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info']

export default async function FindingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: findings } = await supabase
    .from('findings')
    .select('*, scans(scan_type, attack_surfaces(name))')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })

  const counts = SEV_ORDER.reduce((acc, sev) => {
    acc[sev] = findings?.filter(f => f.severity === sev).length ?? 0
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>FINDINGS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{findings?.length ?? 0} total findings</p>
        </div>
      </div>

      {/* Severity breakdown */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {SEV_ORDER.map(sev => (
          <div key={sev} className="gs" style={{ padding: '10px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`sev-${sev}`} style={{ textTransform: 'capitalize' }}>{sev}</span>
            <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{counts[sev]}</span>
          </div>
        ))}
      </div>

      <div className="gs au1" style={{ padding: 24 }}>
        {findings && findings.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Severity</th>
                <th>CVSS</th>
                <th>OWASP</th>
                <th>Target</th>
                <th>Status</th>
                <th>Found</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f: any) => (
                <tr key={f.id} style={{ cursor: 'pointer' }}>
                  <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Link href={`/dashboard/findings/${f.id}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500 }}>
                      {f.title}
                    </Link>
                  </td>
                  <td><span className={`sev-${f.severity}`}>{f.severity}</span></td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{f.cvss_score ?? '—'}</td>
                  <td style={{ fontSize: 11, color: '#64748b' }}>{f.owasp_category ?? '—'}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{(f.scans as any)?.attack_surfaces?.name ?? '—'}</td>
                  <td><span className={`status-${f.status}`}>{f.status}</span></td>
                  <td style={{ color: '#64748b', fontSize: 12 }}>{new Date(f.created_at).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>No findings yet</p>
            <p style={{ fontSize: 13 }}>Run a scan to discover vulnerabilities.</p>
          </div>
        )}
      </div>
    </div>
  )
}
