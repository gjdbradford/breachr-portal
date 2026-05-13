import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissions } from '@/lib/resolve-permissions'
import DashboardNav from '@/components/DashboardNav'
import TopHeader from '@/components/TopHeader'
import HelpPanel from '@/components/HelpPanel'
import SurveyBanner from '@/components/SurveyBanner'
import { HelpPanelProvider } from '@/lib/help-panel-context'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, is_superuser, first_name, last_name, role')
    .eq('supabase_uid', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, onboarding_complete, plan, scans_this_month, plan_scans_limit, tokens_used_this_month, plan_tokens_limit')
    .eq('id', profile.tenant_id)
    .single()

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [
    { count: activeScansCount },
    { count: scansThisMonthCount },
    { count: unackedAssetsCount },
    resolved,
  ] = await Promise.all([
    supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .in('status', ['queued', 'running']),
    supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .is('acknowledged_at', null),
    resolvePermissions(user.id),
  ])

  return (
    <HelpPanelProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0e1a' }}>
        <TopHeader
          email={user.email ?? ''}
          firstName={profile.first_name ?? null}
          lastName={profile.last_name ?? null}
          role={profile.role ?? 'member'}
        />
        <DashboardNav
          tenantName={tenant?.name ?? 'My Company'}
          plan={tenant?.plan ?? 'free'}
          scansThisMonth={scansThisMonthCount ?? 0}
          scansLimit={tenant?.plan_scans_limit ?? 3}
          tokensThisMonth={tenant?.tokens_used_this_month ?? 0}
          tokensLimit={tenant?.plan_tokens_limit ?? 200000}
          isSuperuser={profile.is_superuser ?? false}
          tenantId={profile.tenant_id}
          initialActiveScans={activeScansCount ?? 0}
          initialUnackedAssets={unackedAssetsCount ?? 0}
          showAudit={resolved['audit.read']}
          showScans={resolved['scans.read']}
          showFindings={resolved['findings.read']}
          showInventory={resolved['assets.read']}
        />
        <main className="portal-main">
          {children}
        </main>
        <HelpPanel />
        <SurveyBanner />
      </div>
    </HelpPanelProvider>
  )
}
