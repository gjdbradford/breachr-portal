'use client'

import Link from 'next/link'
import { useScrollDirection } from '@/hooks/useScrollDirection'
import { useHelpPanel } from '@/lib/help-panel-context'
import UserAvatarMenu from '@/components/UserAvatarMenu'

export default function TopHeader({
  email,
  firstName,
  lastName,
  role,
}: {
  email: string
  firstName: string | null
  lastName: string | null
  role: string
}) {
  const scrollDir = useScrollDirection()
  const { isOpen, toggle } = useHelpPanel()

  return (
    <header className={`top-header${scrollDir === 'down' ? ' hidden' : ''}`}>
      {/* Logo — links to dashboard */}
      <Link
        href="/dashboard"
        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg,#1976d2,#42a5f5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <span className="font-display" style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: '0.08em' }}>
          BREACHR
        </span>
      </Link>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Help / AI panel toggle */}
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle help panel"
          aria-pressed={isOpen}
          style={{
            width: 34, height: 34, borderRadius: 8,
            border: `1px solid ${isOpen ? 'rgba(66,165,245,0.4)' : 'rgba(255,255,255,0.08)'}`,
            background: isOpen ? 'rgba(66,165,245,0.08)' : 'rgba(255,255,255,0.03)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: isOpen ? '#42a5f5' : '#64748b',
            fontSize: 14, fontWeight: 700, transition: 'all 0.15s',
          }}
        >
          ?
        </button>

        {/* Avatar */}
        <UserAvatarMenu
          email={email}
          firstName={firstName}
          lastName={lastName}
          role={role}
        />
      </div>
    </header>
  )
}
