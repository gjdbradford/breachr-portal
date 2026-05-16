'use client'

export default function IntegrationsTab() {
  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>Integrations</h3>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 24 }}>Connect third-party tools to your workspace</p>

      <div className="gs au1" style={{ padding: 20, maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          {/* Jira logo stand-in */}
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(0,82,204,0.12)', border: '1px solid rgba(0,82,204,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#0052CC', fontFamily: 'monospace' }}>J</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Jira</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)', letterSpacing: '0.05em' }}>
                COMING SOON
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
              Push remediation tasks to Jira as stories with full replication and remediation steps. When a Jira issue is marked Done, Breachr automatically queues a verification scan.
            </p>
            <button
              disabled
              title="Jira integration coming soon"
              style={{ fontSize: 12, padding: '8px 16px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', cursor: 'not-allowed' }}
            >
              Connect Jira
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
