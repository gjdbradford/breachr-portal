'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPlan, fmtTokens } from '@/lib/plans'
// Note: useRouter still needed for router.refresh() on scan count changes

function readCollapsed(): boolean {
  try { return localStorage.getItem('sidebar-collapsed') === 'true' } catch { return false }
}
function writeCollapsed(val: boolean) {
  try { localStorage.setItem('sidebar-collapsed', String(val)) } catch { /* noop */ }
}

const links = [
  { href: '/dashboard',             label: 'Overview',    icon: '◈' },
  { href: '/dashboard/targets',     label: 'Targets',     icon: '◎' },
  { href: '/dashboard/scans',       label: 'Scans',       icon: '⟳' },
  { href: '/dashboard/findings',    label: 'Findings',    icon: '⚠' },
  { href: '/dashboard/reports',     label: 'Reports',     icon: '▤' },
  { href: '/dashboard/inventory',   label: 'Inventory',   icon: '⬡' },
  { href: '/dashboard/sensors',     label: 'Sensors',     icon: '◉' },
  { href: '/dashboard/audit',       label: 'Audit Trail', icon: '⛓' },
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
  initialUnackedAssets = 0,
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
  initialUnackedAssets?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const plan = getPlan(planId)
  const [activeScans, setActiveScans] = useState(initialActiveScans)
  const [unackedAssets, setUnackedAssets] = useState(initialUnackedAssets)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const val = readCollapsed()
    setCollapsed(val)
    if (val) document.body.classList.add('sidebar-collapsed')
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    writeCollapsed(next)
    document.body.classList.toggle('sidebar-collapsed', next)
  }

  // Sync with server-side value after router.refresh() re-renders the layout
  useEffect(() => { setActiveScans(initialActiveScans) }, [initialActiveScans])
  useEffect(() => { setUnackedAssets(initialUnackedAssets) }, [initialUnackedAssets])

  useEffect(() => {
    if (!tenantId) return
    const supabase = createClient()

    const refreshCount = () => {
      supabase
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['queued', 'running'])
        .then(({ count }) => {
          const newCount = count ?? 0
          setActiveScans(prev => {
            if (newCount === 0 && prev > 0) router.refresh()
            return newCount
          })
        })
    }

    const channel = supabase
      .channel(`nav-scans-${tenantId}`)
      // INSERT catches newly launched scans immediately (before scanner picks them up)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scans', filter: `tenant_id=eq.${tenantId}` }, refreshCount)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scans', filter: `tenant_id=eq.${tenantId}` }, refreshCount)
      .subscribe()

    // Poll every 10s as a safety net in case Realtime misses an event
    const poll = setInterval(refreshCount, 10_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tenantId) return
    const supabase = createClient()

    const refreshUnacked = () => {
      supabase
        .from('assets')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('acknowledged_at', null)
        .then(({ count }) => setUnackedAssets(count ?? 0))
    }

    const channel = supabase
      .channel(`nav-assets-${tenantId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assets', filter: `tenant_id=eq.${tenantId}` }, refreshUnacked)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assets', filter: `tenant_id=eq.${tenantId}` }, refreshUnacked)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  const scansPct   = scansLimit   ? Math.min(100, (scansThisMonth / scansLimit) * 100)     : 0
  const tokensPct  = tokensLimit  ? Math.min(100, (tokensThisMonth / tokensLimit) * 100)    : 0
  const scansAtLimit  = scansPct >= 100
  const tokensAtLimit = tokensPct >= 100
  const scansNear  = scansPct >= 80
  const tokensNear = tokensPct >= 80

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={toggleCollapsed}
        className="sidebar-collapse-btn"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '›' : '‹'}
      </button>

      {!collapsed && (
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid rgba(25,118,210,0.08)' }}>
          <p style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenantName}</p>
        </div>
      )}

      <nav style={{ flex: 1, padding: '8px 4px', overflow: 'visible' }}>
        {links.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          const showScansBadge = href === '/dashboard/scans' && activeScans > 0
          const showInvBadge   = href === '/dashboard/inventory' && unackedAssets > 0

          if (collapsed) {
            return (
              <Link key={href} href={href} className={`rail-item${active ? ' active' : ''}`}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span className="rail-tooltip">
                  {label}
                  {showScansBadge && (
                    <span style={{ marginLeft: 6, minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px', background: '#42a5f5', color: '#0a0e1a', fontSize: 9, fontWeight: 800, fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {activeScans}
                    </span>
                  )}
                  {showInvBadge && (
                    <span style={{ marginLeft: 6, minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px', background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 800, fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {unackedAssets}
                    </span>
                  )}
                </span>
              </Link>
            )
          }

          return (
            <Link key={href} href={href} className={`sidebar-link${active ? ' active' : ''}`}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {showScansBadge && (
                <span style={{ minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px', background: '#42a5f5', color: '#0a0e1a', fontSize: 10, fontWeight: 800, fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s infinite' }}>
                  {activeScans}
                </span>
              )}
              {showInvBadge && (
                <span style={{ minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px', background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unackedAssets}
                </span>
              )}
            </Link>
          )
        })}
        {isSuperuser && !collapsed && (
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

      {!collapsed && <div style={{ margin: '0 12px 12px', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
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
          <Link href="/dashboard/upgrade" style={{ display: 'block', marginTop: 8, fontSize: 9, textDecoration: 'none', textAlign: 'center', padding: '4px 0', borderRadius: 4,
            color:       (scansAtLimit || tokensAtLimit) ? '#ef4444' : '#f59e0b',
            background:  (scansAtLimit || tokensAtLimit) ? 'rgba(239,68,68,0.08)'   : 'rgba(245,158,11,0.08)',
            border:      (scansAtLimit || tokensAtLimit) ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(245,158,11,0.2)',
          }}>
            {(scansAtLimit || tokensAtLimit) ? '🚫 Limit reached — upgrade' : '⚡ Approaching limit — upgrade'}
          </Link>
        )}
      </div>}

    </aside>
  )
}
