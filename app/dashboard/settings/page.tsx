import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import SettingsTabs from '@/components/settings/SettingsTabs'
import { resolvePermissions } from '@/lib/resolve-permissions'
import type { SubscriptionData } from '@/components/settings/SubscriptionTab'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, email, role, phone')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) redirect('/login')

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [{ data: tenant }, resolved, { data: tpRow }, { data: owner }] = await Promise.all([
    supabase
      .from('tenants')
      .select('name, industry, company_size, country, timezone, compliance_frameworks, plan')
      .eq('id', profile.tenant_id)
      .single(),
    resolvePermissions(user.id),
    admin
      .from('tenant_packages')
      .select('package:packages(name, slug, price_monthly, scans_limit, tokens_limit, targets_limit)')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle(),
    admin
      .from('users')
      .select('email, first_name, last_name')
      .eq('tenant_id', profile.tenant_id)
      .eq('role', 'account_owner')
      .maybeSingle(),
  ])

  const tenantData = tenant ?? { name: '', industry: '', company_size: '', country: null, timezone: 'UTC', compliance_frameworks: [] }
  const userData   = { email: profile.email ?? user.email ?? '', role: profile.role ?? 'member', phone: profile.phone ?? '' }

  const pkg = (tpRow as any)?.package ?? null

  let subscription: SubscriptionData

  if (pkg) {
    subscription = {
      packageName:  pkg.name,
      packageSlug:  pkg.slug,
      priceMonthly: pkg.price_monthly,
      scansLimit:   pkg.scans_limit,
      tokensLimit:  pkg.tokens_limit,
      targetsLimit: pkg.targets_limit,
      ownerEmail:   owner?.email ?? null,
      ownerName:    owner?.first_name && owner?.last_name
        ? `${owner.first_name} ${owner.last_name}`
        : owner?.first_name ?? null,
    }
  } else {
    // No tenant_packages row — fall back to tenants.plan slug
    const planSlug = (tenant as any)?.plan ?? 'freemium'
    const { data: fallbackPkg } = await admin
      .from('packages')
      .select('name, slug, price_monthly, scans_limit, tokens_limit, targets_limit')
      .eq('slug', planSlug)
      .maybeSingle()

    subscription = {
      packageName:  fallbackPkg?.name ?? planSlug.toUpperCase(),
      packageSlug:  fallbackPkg?.slug ?? planSlug,
      priceMonthly: fallbackPkg?.price_monthly ?? null,
      scansLimit:   fallbackPkg?.scans_limit ?? null,
      tokensLimit:  fallbackPkg?.tokens_limit ?? null,
      targetsLimit: fallbackPkg?.targets_limit ?? null,
      ownerEmail:   owner?.email ?? null,
      ownerName:    owner?.first_name && owner?.last_name
        ? `${owner.first_name} ${owner.last_name}`
        : owner?.first_name ?? null,
    }
  }

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>SETTINGS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Manage your account and compliance preferences</p>
        </div>
      </div>
      <SettingsTabs
        tenant={tenantData}
        user={userData}
        tenantId={profile.tenant_id}
        currentUserId={user.id}
        canInvite={resolved['team.invite']}
        showTeam={resolved['team.read']}
        subscription={subscription}
      />
    </div>
  )
}
