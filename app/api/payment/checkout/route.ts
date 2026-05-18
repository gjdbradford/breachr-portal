import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderForRegion } from '@/lib/payment/factory'
import { PayFastNotImplementedError } from '@/lib/payment/providers/payfast'
import type { BillingPeriod } from '@/lib/payment/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 400 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, stripe_customer_id, billing_region')
    .eq('id', (profile as any).tenant_id)
    .single()

  const body = await req.json()
  const packageId = body.packageId as string
  const period    = body.period as BillingPeriod

  if (!packageId || !period) {
    return NextResponse.json({ error: 'packageId and period are required' }, { status: 400 })
  }

  const { data: pkg } = await supabase
    .from('packages')
    .select('stripe_price_monthly_id, stripe_price_annual_id')
    .eq('id', packageId)
    .single()

  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

  const priceId = period === 'annual'
    ? (pkg as any).stripe_price_annual_id
    : (pkg as any).stripe_price_monthly_id
  if (!priceId) {
    return NextResponse.json({ error: 'Package not available for purchase' }, { status: 400 })
  }

  const provider = getProviderForRegion((tenant as any)?.billing_region)
  const origin   = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

  try {
    const result = await provider.createCheckoutSession({
      packageId,
      period,
      providerPriceId:    priceId,
      tenantId:           (profile as any).tenant_id,
      customerEmail:      user.email!,
      customerName:       (tenant as any)?.name ?? null,
      existingCustomerId: (tenant as any)?.stripe_customer_id ?? null,
      successUrl:         `${origin}/dashboard/upgrade/success`,
      cancelUrl:          `${origin}/dashboard/upgrade`,
    })

    if (result.customerId !== (tenant as any)?.stripe_customer_id) {
      await supabase
        .from('tenants')
        .update({ stripe_customer_id: result.customerId })
        .eq('id', (profile as any).tenant_id)
    }

    return NextResponse.json({ url: result.url })
  } catch (err) {
    if (err instanceof PayFastNotImplementedError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    throw err
  }
}
