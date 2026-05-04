import Link from 'next/link'

export default function UpgradeSuccess() {
  return (
    <div className="portal-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: 28,
        }}>✓</div>
        <h1 className="font-display" style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', marginBottom: 12, letterSpacing: '0.05em' }}>
          PLAN UPGRADED
        </h1>
        <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7, marginBottom: 28 }}>
          Your subscription is now active. Your new scan limits, token allowance, and scan types are live immediately.
          A receipt has been sent to your email.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard/scans" className="btn-p" style={{ fontSize: 13, padding: '10px 24px' }}>
            Launch a Scan →
          </Link>
          <Link href="/dashboard/upgrade" className="btn-s" style={{ fontSize: 13, padding: '10px 24px' }}>
            View Plan
          </Link>
        </div>
      </div>
    </div>
  )
}
