import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 400 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', profile.tenant_id)
    .single()

  if (!tenant?.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer' }, { status: 400 })
  }

  const origin = req.headers.get('origin') ?? 'https://portal-seven-taupe.vercel.app'

  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: `${origin}/dashboard/upgrade`,
  })

  return NextResponse.json({ url: session.url })
}
