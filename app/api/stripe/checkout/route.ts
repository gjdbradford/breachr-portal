import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PRICE_IDS } from '@/lib/stripe'
import type { BillingPeriod, StripePlanId } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 400 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, stripe_customer_id')
    .eq('id', profile.tenant_id)
    .single()

  const body = await req.json()
  const planId = body.planId as StripePlanId
  const period = body.period as BillingPeriod

  if (!PRICE_IDS[planId]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const priceId = PRICE_IDS[planId][period]
  if (!priceId) return NextResponse.json({ error: 'Price not configured' }, { status: 400 })

  // Reuse or create Stripe customer
  let customerId = tenant?.stripe_customer_id as string | undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: tenant?.name ?? undefined,
      metadata: { tenant_id: profile.tenant_id },
    })
    customerId = customer.id
    await supabase.from('tenants').update({ stripe_customer_id: customerId }).eq('id', profile.tenant_id)
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal-seven-taupe.vercel.app'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/upgrade`,
    subscription_data: {
      metadata: { tenant_id: profile.tenant_id, plan_id: planId },
    },
    metadata: { tenant_id: profile.tenant_id, plan_id: planId },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    customer_update: { address: 'auto' },
  })

  return NextResponse.json({ url: session.url })
}
