import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardNav from '@/components/DashboardNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, onboarding_complete, plan, scans_this_month, plan_scans_limit, tokens_used_this_month, plan_tokens_limit')
    .eq('id', profile.tenant_id)
    .single()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0e1a' }}>
      <DashboardNav
        tenantName={tenant?.name ?? 'My Company'}
        plan={tenant?.plan ?? 'free'}
        scansThisMonth={tenant?.scans_this_month ?? 0}
        scansLimit={tenant?.plan_scans_limit ?? 3}
        tokensThisMonth={tenant?.tokens_used_this_month ?? 0}
        tokensLimit={tenant?.plan_tokens_limit ?? 200000}
      />
      <main className="portal-main">
        {children}
      </main>
    </div>
  )
}
