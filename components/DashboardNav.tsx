'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const links = [
  { href: '/dashboard', label: 'Overview', icon: '◈' },
  { href: '/dashboard/scans', label: 'Scans', icon: '⟳' },
  { href: '/dashboard/findings', label: 'Findings', icon: '⚠' },
  { href: '/dashboard/reports', label: 'Reports', icon: '▤' },
]

export default function DashboardNav({ tenantName }: { tenantName: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="sidebar">
      <div style={{ padding: '24px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#1976d2,#42a5f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="font-display" style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: '0.08em' }}>BREACHR</span>
        </div>
        <p style={{ fontSize: 11, color: '#64748b', paddingLeft: 42, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenantName}</p>
      </div>

      <nav style={{ flex: 1, padding: '8px 12px' }}>
        {links.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} className={`sidebar-link${active ? ' active' : ''}`}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '12px 12px 24px' }}>
        <button
          onClick={handleSignOut}
          className="sidebar-link"
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
        >
          <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>⏻</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
