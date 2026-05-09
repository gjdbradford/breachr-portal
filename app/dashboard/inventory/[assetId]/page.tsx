import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AcknowledgeOnMount from '@/components/AcknowledgeOnMount'
import AssetClassificationCard from '@/components/AssetClassificationCard'

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e',
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>
}) {
  const { assetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id, role').eq('supabase_uid', user.id).single()
  if (!profile) redirect('/login')

  const [
    { data: asset },
    { data: ports },
    { data: vulns },
  ] = await Promise.all([
    supabase
      .from('assets')
      .select('id, ip, mac, hostname, vendor, os_guess, first_seen, last_seen, is_active, risk_score, sensor_id, acknowledged_at, criticality, asset_type_label, department, owner_name, owner_email, physical_location, classification_notes, classified_at')
      .eq('id', assetId)
      .eq('tenant_id', profile.tenant_id)
      .single(),
    supabase
      .from('asset_ports')
      .select('port, protocol, service, banner, last_seen')
      .eq('asset_id', assetId)
      .order('port', { ascending: true }),
    supabase
      .from('asset_vulns')
      .select('cve_id, severity, cvss_score, title, last_checked')
      .eq('asset_id', assetId)
      .order('cvss_score', { ascending: false }),
  ])

  if (!asset) notFound()

  const { data: sensor } = await supabase
    .from('sensors')
    .select('name, location')
    .eq('id', asset.sensor_id)
    .single()

  const score = asset.risk_score ?? 0
  const riskColor = score >= 80 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 20 ? '#f59e0b' : '#64748b'

  return (
    <div className="portal-content">
      {!asset.acknowledged_at && <AcknowledgeOnMount assetId={asset.id} />}
      <div className="portal-header">
        <div>
          <div style={{ marginBottom: 4 }}>
            <Link href="/dashboard/inventory" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none' }}>
              ← Inventory
            </Link>
          </div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>
            {asset.hostname ?? asset.ip}
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {asset.ip} · {asset.mac}
            {sensor?.location && ` · ${sensor.location}`}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: riskColor }}>{score > 0 ? score : '—'}</div>
          <div style={{ fontSize: 11, color: '#475569' }}>risk score</div>
        </div>
      </div>

      <div className="gs au1" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: 16 }}>ASSET DETAILS</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {([
            ['Vendor',     asset.vendor    ?? '—'],
            ['OS',         asset.os_guess  ?? '—'],
            ['Status',     asset.is_active ? 'Active' : 'Offline'],
            ['First seen', new Date(asset.first_seen).toLocaleDateString('en-GB')],
            ['Last seen',  new Date(asset.last_seen).toLocaleDateString('en-GB')],
            ['Sensor',     sensor?.name ?? '—'],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, color: '#e2e8f0' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="gs au1" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: 16 }}>
          OPEN PORTS ({(ports ?? []).length})
        </h2>
        {(ports ?? []).length === 0 ? (
          <p style={{ fontSize: 13, color: '#475569' }}>No ports discovered — run an active scan to discover open ports.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Port</th><th>Protocol</th><th>Service</th><th>Banner</th><th>Last seen</th></tr>
            </thead>
            <tbody>
              {(ports ?? []).map(p => (
                <tr key={`${p.port}-${p.protocol}`}>
                  <td style={{ fontFamily: 'monospace', color: '#e2e8f0', fontSize: 13 }}>{p.port}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{p.protocol}</td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{p.service ?? '—'}</td>
                  <td style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>{p.banner ?? '—'}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(p.last_seen).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AssetClassificationCard
        assetId={asset.id}
        userRole={profile.role ?? 'member'}
        initial={{
          criticality:          asset.criticality          ?? null,
          asset_type_label:     asset.asset_type_label     ?? null,
          department:           asset.department           ?? null,
          owner_name:           asset.owner_name           ?? null,
          owner_email:          asset.owner_email          ?? null,
          physical_location:    asset.physical_location    ?? null,
          classification_notes: asset.classification_notes ?? null,
          classified_at:        asset.classified_at        ?? null,
        }}
      />

      <div className="gs au1" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: 16 }}>
          CVE FINDINGS ({(vulns ?? []).length})
        </h2>
        {(vulns ?? []).length === 0 ? (
          <p style={{ fontSize: 13, color: '#475569' }}>No CVE matches found for this asset.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>CVE</th><th>Severity</th><th>CVSS</th><th>Description</th></tr>
            </thead>
            <tbody>
              {(vulns ?? []).map(v => (
                <tr key={v.cve_id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{v.cve_id}</td>
                  <td>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                      background: `${SEVERITY_COLORS[v.severity] ?? '#64748b'}22`,
                      color: SEVERITY_COLORS[v.severity] ?? '#64748b',
                      border: `1px solid ${SEVERITY_COLORS[v.severity] ?? '#64748b'}44`,
                    }}>
                      {v.severity}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{v.cvss_score ?? '—'}</td>
                  <td style={{ fontSize: 12, color: '#64748b', maxWidth: 400 }}>{v.title ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
