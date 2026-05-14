'use client'

import { useState } from 'react'
import ProfileTab, { type TenantProfile, type UserProfile } from './ProfileTab'
import ComplianceTab from './ComplianceTab'
import TeamTab from './TeamTab'
import PermissionsTab from './PermissionsTab'
import SubscriptionTab, { type SubscriptionData } from './SubscriptionTab'

type Tab = 'profile' | 'compliance' | 'team' | 'permissions' | 'subscription'

const TAB_LABELS: Record<Tab, string> = {
  profile:      'Profile',
  compliance:   'Compliance',
  team:         'Team',
  permissions:  'Permissions',
  subscription: 'Subscription',
}

export default function SettingsTabs({
  tenant,
  user,
  tenantId,
  currentUserId,
  canInvite,
  showTeam = true,
  subscription,
}: {
  tenant: TenantProfile & { compliance_frameworks: string[] }
  user: UserProfile
  tenantId: string
  currentUserId: string
  canInvite?: boolean
  showTeam?: boolean
  subscription: SubscriptionData
}) {
  const isOwner = user.role === 'account_owner'
  const tabs: Tab[] = isOwner
    ? ['profile', 'compliance', 'team', 'permissions', 'subscription']
    : (['profile', 'compliance', showTeam ? 'team' : null, 'subscription'] as Array<Tab | null>).filter((t): t is Tab => t !== null)

  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map(tab => (
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

      {activeTab === 'profile'     && <ProfileTab tenant={tenant} user={user} tenantId={tenantId} currentUserId={currentUserId} companyReadOnly={!isOwner} />}
      {activeTab === 'compliance'  && <ComplianceTab
        frameworks={tenant.compliance_frameworks}
        tenantId={tenantId}
        lockedReason={
          !isOwner ? 'admin'
          : (tenant.compliance_frameworks ?? []).length > 0 ? 'locked'
          : null
        }
      />}
      {activeTab === 'team'        && <TeamTab currentUserId={currentUserId} currentUserRole={user.role} canInvite={canInvite} timezone={tenant.timezone ?? 'UTC'} />}
      {activeTab === 'permissions' && isOwner && <PermissionsTab />}
      {activeTab === 'subscription' && <SubscriptionTab data={subscription} />}
    </div>
  )
}
