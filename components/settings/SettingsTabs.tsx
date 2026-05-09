'use client'

import { useState } from 'react'
import ProfileTab, { type TenantProfile, type UserProfile } from './ProfileTab'
import ComplianceTab from './ComplianceTab'
import TeamTab from './TeamTab'

type Tab = 'profile' | 'compliance' | 'team'

const TAB_LABELS: Record<Tab, string> = {
  profile:    'Profile',
  compliance: 'Compliance',
  team:       'Team',
}

export default function SettingsTabs({
  tenant,
  user,
  tenantId,
  currentUserId,
}: {
  tenant: TenantProfile & { compliance_frameworks: string[] }
  user: UserProfile
  tenantId: string
  currentUserId: string
}) {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['profile', 'compliance', 'team'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 20px', fontSize: 13, fontWeight: 600,
              color: activeTab === tab ? '#42a5f5' : '#64748b',
              borderBottom: `2px solid ${activeTab === tab ? '#42a5f5' : 'transparent'}`,
              marginBottom: -1, letterSpacing: '0.03em',
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'profile'    && <ProfileTab tenant={tenant} user={user} tenantId={tenantId} />}
      {activeTab === 'compliance' && <ComplianceTab frameworks={tenant.compliance_frameworks} tenantId={tenantId} />}
      {activeTab === 'team'       && <TeamTab currentUserId={currentUserId} currentUserRole={user.role} />}
    </div>
  )
}
