import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import FindingStatusButton from '@/components/FindingStatusButton'

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#3b82f6',
  info:     '#64748b',
}

const CVSS_LABEL: Record<string, string> = {
  critical: 'Critical (9.0–10.0)',
  high:     'High (7.0–8.9)',
  medium:   'Medium (4.0–6.9)',
  low:      'Low (0.1–3.9)',
  info:     'Informational',
}

export default async function FindingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: finding } = await supabase
    .from('findings')
    .select('*, scans(id, scan_type, started_at, attack_surfaces(name, target_url, target_type))')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!finding) notFound()

  // Fetch the accepting user's email if a risk decision was recorded
  let acceptedByEmail: string | null = null
  if (finding.risk_accepted_by) {
    const { data: acceptedByUser } = await supabase
      .from('users')
      .select('email')
      .eq('id', finding.risk_accepted_by)
      .single()
    acceptedByEmail = acceptedByUser?.email ?? null
  }

  const sevColor = SEV_COLOR[finding.severity] ?? '#64748b'
  const scan = (finding.scans as any)
  const surface = scan?.attack_surfaces

  const remediationSteps = finding.remediation
    ? finding.remediation.split('\n').filter(Boolean)
    : null

  const replicationSteps = finding.replication_steps
    ? finding.replication_steps.split('\n').filter(Boolean)
    : null

  return (
    <div className="portal-content">
      {/* Back nav */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/dashboard/findings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', textDecoration: 'none' }}>
          ← Back to findings
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <span style={{
            padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: `${sevColor}18`, border: `1px solid ${sevColor}40`, color: sevColor,
            flexShrink: 0, marginTop: 2,
          }}>
            {finding.severity}
          </span>
          <h1 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.03em', lineHeight: 1.3 }}>
            {finding.title}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <FindingStatusButton findingId={finding.id} currentStatus={finding.status} findingTitle={finding.title} />
          {finding.owasp_category && (
            <span style={{ fontSize: 11, color: '#64748b', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '3px 8px' }}>
              {finding.owasp_category}
            </span>
          )}
          {finding.cvss_score && (
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: sevColor, background: `${sevColor}10`, border: `1px solid ${sevColor}30`, borderRadius: 4, padding: '3px 8px' }}>
              CVSS {finding.cvss_score} · {CVSS_LABEL[finding.severity]}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Description */}
          {finding.description && (
            <div className="gs au1" style={{ padding: 20 }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Description
              </h2>
              <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {finding.description}
              </p>
            </div>
          )}

          {/* Replication Steps */}
          <div className="gs au1" style={{ padding: 20, borderLeft: `3px solid #f59e0b` }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              How to Reproduce
            </h2>
            {replicationSteps ? (
              <ol style={{ paddingLeft: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {replicationSteps.map((step: string, i: number) => {
                  const clean = step.replace(/^\d+\.\s*/, '')
                  return (
                    <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                        color: '#f59e0b', fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'monospace', marginTop: 1,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, fontFamily: clean.startsWith('curl') || clean.startsWith('GET') || clean.startsWith('POST') ? 'monospace' : undefined, whiteSpace: 'pre-wrap' }}>{clean}</span>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p style={{ fontSize: 13, color: '#64748b' }}>No replication steps recorded — run a new scan to generate them.</p>
            )}
          </div>

          {/* Remediation */}
          <div className="gs au1" style={{ padding: 20, borderLeft: `3px solid #22c55e` }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              Remediation Steps
            </h2>
            {remediationSteps ? (
              <ol style={{ paddingLeft: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {remediationSteps.map((step: string, i: number) => {
                  const clean = step.replace(/^\d+\.\s*/, '')
                  return (
                    <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                        color: '#22c55e', fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'monospace', marginTop: 1,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>{clean}</span>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p style={{ fontSize: 13, color: '#64748b' }}>No remediation steps recorded for this finding.</p>
            )}
          </div>

          {/* AI Analysis */}
          {(finding.ai_model || finding.ai_confidence) && (
            <div className="gs au1" style={{ padding: 20 }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                AI Analysis
              </h2>
              <div style={{ display: 'flex', gap: 16 }}>
                {finding.ai_model && (
                  <div>
                    <p style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Model</p>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '4px 10px' }}>
                      {finding.ai_model}
                    </span>
                  </div>
                )}
                {finding.ai_confidence && (
                  <div>
                    <p style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Confidence</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 80, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${finding.ai_confidence}%`, background: finding.ai_confidence >= 80 ? '#22c55e' : '#f59e0b', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: finding.ai_confidence >= 80 ? '#22c55e' : '#f59e0b' }}>
                        {finding.ai_confidence}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Scan context */}
          <div className="gs au1" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Scan Context
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {surface && (
                <>
                  <Row label="Target" value={surface.name} />
                  <Row label="URL" value={surface.target_url} mono />
                  <Row label="Type" value={surface.target_type} />
                </>
              )}
              {scan && (
                <>
                  <Row label="Scan type" value={scan.scan_type} />
                  <Row label="Started" value={scan.started_at ? new Date(scan.started_at).toLocaleString('en-GB') : '—'} />
                </>
              )}
              {scan?.id && (
                <Link href={`/dashboard/scans/${scan.id}`} style={{ fontSize: 11, color: '#42a5f5', marginTop: 4 }}>
                  View scan →
                </Link>
              )}
            </div>
          </div>

          {/* Cryptographic proof */}
          <div className="gs au1" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Cryptographic Proof
            </h3>
            <p style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>
              SHA-256 hash of finding fields — tamper-evident evidence for regulators.
            </p>
            {finding.finding_hash ? (
              <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#3b82f6', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 4, padding: '8px 10px', wordBreak: 'break-all', lineHeight: 1.6 }}>
                {finding.finding_hash}
              </div>
            ) : (
              <p style={{ fontSize: 11, color: '#475569' }}>No hash recorded</p>
            )}
          </div>

          {/* Timeline */}
          <div className="gs au1" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Timeline
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Row label="Discovered" value={new Date(finding.created_at).toLocaleString('en-GB')} />
              <Row label="Status" value={finding.status} />
            </div>
          </div>

          {/* Risk decision record */}
          {(finding.status === 'accepted_risk' || finding.status === 'false_positive') && finding.risk_acceptance_reason && (
            <div className="gs au1" style={{ padding: 16, borderLeft: `3px solid ${finding.status === 'accepted_risk' ? '#8b5cf6' : '#64748b'}` }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, color: finding.status === 'accepted_risk' ? '#8b5cf6' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                {finding.status === 'accepted_risk' ? 'Risk Acceptance' : 'False Positive'}
              </h3>
              <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 10 }}>
                {finding.risk_acceptance_reason}
              </p>
              {acceptedByEmail && (
                <p style={{ fontSize: 10, color: '#475569' }}>
                  Recorded by <span style={{ color: '#64748b' }}>{acceptedByEmail}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', fontSize: 11 }}>
      <span style={{ color: '#64748b', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#cbd5e1', textAlign: 'right', fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all', fontSize: mono ? 10 : 11 }}>{value}</span>
    </div>
  )
}
