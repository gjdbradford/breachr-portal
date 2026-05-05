'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPlan, fmtTokens } from '@/lib/plans'

const links = [
  { href: '/dashboard',          label: 'Overview',    icon: '◈' },
  { href: '/dashboard/targets',  label: 'Targets',     icon: '◎' },
  { href: '/dashboard/scans',    label: 'Scans',       icon: '⟳' },
  { href: '/dashboard/findings', label: 'Findings',    icon: '⚠' },
  { href: '/dashboard/reports',  label: 'Reports',     icon: '▤' },
  { href: '/dashboard/audit',    label: 'Audit Trail', icon: '⛓' },
  { href: '/dashboard/settings', label: 'Settings',    icon: '⚙' },
]

export default function DashboardNav({
  tenantName,
  plan: planId = 'free',
  scansThisMonth = 0,
  scansLimit = 3,
  tokensThisMonth = 0,
  tokensLimit = 200000,
  isSuperuser = false,
  tenantId,
  initialActiveScans = 0,
}: {
  tenantName: string
  plan?: string
  scansThisMonth?: number
  scansLimit?: number
  tokensThisMonth?: number
  tokensLimit?: number
  isSuperuser?: boolean
  tenantId?: string
  initialActiveScans?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const plan = getPlan(planId)
  const [activeScans, setActiveScans] = useState(initialActiveScans)

  // Sync with server-side value after router.refresh() re-renders the layout
  useEffect(() => { setActiveScans(initialActiveScans) }, [initialActiveScans])

  useEffect(() => {
    if (!tenantId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`nav-scans-${tenantId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'scans', filter: `tenant_id=eq.${tenantId}`,
      }, () => {
        supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', ['queued', 'running'])
          .then(({ count }) => {
            const newCount = count ?? 0
            if (newCount === 0 && activeScans > 0) router.refresh()
            setActiveScans(newCount)
          })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  const scansPct   = scansLimit   ? Math.min(100, (scansThisMonth / scansLimit) * 100)     : 0
  const tokensPct  = tokensLimit  ? Math.min(100, (tokensThisMonth / tokensLimit) * 100)    : 0
  const scansNear  = scansPct >= 80
  const tokensNear = tokensPct >= 80

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
          const showBadge = href === '/dashboard/scans' && activeScans > 0
          return (
            <Link key={href} href={href} className={`sidebar-link${active ? ' active' : ''}`}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {showBadge && (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px',
                  background: '#42a5f5', color: '#0a0e1a',
                  fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'pulse 1.5s infinite',
                }}>
                  {activeScans}
                </span>
              )}
            </Link>
          )
        })}
        {isSuperuser && (
          <>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 4px' }} />
            <a
              href="https://admin-gjdbradford-5891s-projects.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="sidebar-link"
              style={{ color: '#a78bfa' }}
            >
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>⬡</span>
              <span>Founders Portal</span>
            </a>
          </>
        )}
      </nav>

      {/* Plan usage widget */}
      <div style={{ margin: '0 12px 12px', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Plan badge + upgrade link */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: plan.color, display: 'inline-block' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: plan.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{plan.label}</span>
          </div>
          {planId !== 'enterprise' && (
            <Link href="/dashboard/upgrade" style={{ fontSize: 9, color: '#42a5f5', textDecoration: 'none', fontWeight: 600, letterSpacing: '0.04em' }}>
              Upgrade ↑
            </Link>
          )}
        </div>

        {/* Scans meter */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Scans</span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: scansNear ? '#f59e0b' : '#64748b' }}>
              {scansThisMonth} / {scansLimit}
            </span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${scansPct}%`, background: scansPct >= 100 ? '#ef4444' : scansNear ? '#f59e0b' : '#42a5f5', borderRadius: 2, transition: 'width 0.4s' }} />
          </div>
        </div>

        {/* Tokens meter */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tokens</span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: tokensNear ? '#f59e0b' : '#64748b' }}>
              {fmtTokens(tokensThisMonth)} / {fmtTokens(tokensLimit)}
            </span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${tokensPct}%`, background: tokensPct >= 100 ? '#ef4444' : tokensNear ? '#f59e0b' : '#a78bfa', borderRadius: 2, transition: 'width 0.4s' }} />
          </div>
        </div>

        {(scansNear || tokensNear) && (
          <Link href="/dashboard/upgrade" style={{ display: 'block', marginTop: 8, fontSize: 9, color: '#f59e0b', textDecoration: 'none', textAlign: 'center', padding: '4px 0', borderRadius: 4, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            ⚡ Approaching limit — upgrade
          </Link>
        )}
      </div>

      <div style={{ padding: '0 12px 24px' }}>
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
