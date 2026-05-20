// portal/app/onboarding/payment/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBillingRegion } from '@/lib/eu-countries'
import PaymentWallClient from './PaymentWallClient'

export default async function OnboardingPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) redirect('/login?error=no_account')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('billing_region, intended_package_slug, country')
    .eq('id', (profile as any).tenant_id)
    .single()

  const intendedSlug = (tenant as any)?.intended_package_slug as string | null

  // If intended package already cleared (payment done) → skip to step 2
  if (!intendedSlug) redirect('/onboarding?step=2')

  const { data: pkg } = await supabase
    .from('packages')
    .select('id, name, price_monthly, trial_period_days')
    .eq('slug', intendedSlug)
    .eq('status', 'active')
    .single()

  if (!pkg) redirect('/onboarding?step=2')

  // Derive billing region from tenant's stored value or country
  const region = (tenant as any)?.billing_region ?? getBillingRegion((tenant as any)?.country)
  const currency: 'eur' | 'usd' = region === 'eu' ? 'eur' : 'usd'

  const trialDays = (pkg as any).trial_period_days ?? 0
  const trialEndDate = trialDays > 0
    ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
    : new Date().toISOString()

  const sp = await searchParams
  const cancelled = sp.cancelled === 'true'

  return (
    <PaymentWallClient
      packageId={(pkg as any).id}
      packageName={(pkg as any).name}
      trialDays={trialDays}
      priceMonthly={(pkg as any).price_monthly ?? 0}
      currency={currency}
      trialEndDate={trialEndDate}
      cancelled={cancelled}
    />
  )
}
