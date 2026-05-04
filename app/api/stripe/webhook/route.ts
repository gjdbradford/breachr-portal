import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { PLANS } from '@/lib/plans'
import type { PlanId } from '@/lib/plans'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const PLAN_LIMITS: Record<string, { scans: number | null; tokens: number | null; targets: number | null; mrr: number }> = {
  starter:      { scans: 20,   tokens: 3_000_000,  targets: 5,    mrr: 159   },
  professional: { scans: 50,   tokens: 10_000_000, targets: 10,   mrr: 350   },
  enterprise:   { scans: null, tokens: 50_000_000, targets: null, mrr: 15000 },
  free:         { scans: 3,    tokens: 200_000,    targets: 1,    mrr: 0     },
}

async function applyPlan(tenantId: string, planId: PlanId, billingPeriod?: string) {
  const limits = PLAN_LIMITS[planId]
  if (!limits) return
  const supabase = adminClient()
  await supabase.from('tenants').update({
    plan:               planId,
    plan_scans_limit:   limits.scans,
    plan_tokens_limit:  limits.tokens,
    plan_targets_limit: limits.targets,
    mrr_eur:            limits.mrr,
    plan_started_at:    new Date().toISOString(),
  }).eq('id', tenantId)
}

async function logSubscriptionEvent(
  supabase: ReturnType<typeof adminClient>,
  {
    tenantId, eventType, fromPlan, toPlan, mrrDelta, mrrAfter, billingPeriod, stripeEventId, stripeInvoiceId,
  }: {
    tenantId: string; eventType: string; fromPlan?: string; toPlan?: string;
    mrrDelta?: number; mrrAfter?: number; billingPeriod?: string;
    stripeEventId?: string; stripeInvoiceId?: string;
  }
) {
  await supabase.from('subscription_events').insert({
    tenant_id:       tenantId,
    event_type:      eventType,
    from_plan:       fromPlan,
    to_plan:         toPlan,
    mrr_delta_eur:   mrrDelta,
    mrr_after_eur:   mrrAfter,
    billing_period:  billingPeriod,
    stripe_event_id: stripeEventId,
    stripe_invoice_id: stripeInvoiceId,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = adminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any
      const tenantId   = session.metadata?.tenant_id
      const planId     = session.metadata?.plan_id as PlanId
      const period     = session.metadata?.billing_period

      if (tenantId && planId) {
        // Get previous plan for delta calculation
        const { data: tenant } = await supabase.from('tenants').select('plan, mrr_eur').eq('id', tenantId).single()
        const fromPlan = tenant?.plan ?? 'free'
        const fromMrr  = tenant?.mrr_eur ?? 0
        const toMrr    = PLAN_LIMITS[planId]?.mrr ?? 0

        await applyPlan(tenantId, planId, period)

        // Store Stripe customer + subscription IDs
        if (session.customer) {
          await supabase.from('tenants').update({
            stripe_customer_id:    session.customer,
            stripe_subscription_id: session.subscription,
          }).eq('id', tenantId)
        }

        await logSubscriptionEvent(supabase, {
          tenantId,
          eventType:      fromPlan === 'free' ? 'upgraded' : toMrr > fromMrr ? 'upgraded' : 'downgraded',
          fromPlan,
          toPlan:         planId,
          mrrDelta:       toMrr - fromMrr,
          mrrAfter:       toMrr,
          billingPeriod:  period,
          stripeEventId:  event.id,
        })
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub     = event.data.object as any
      const tenantId = sub.metadata?.tenant_id
      const planId   = sub.metadata?.plan_id as PlanId

      if (tenantId && planId && (sub.status === 'active' || sub.status === 'trialing')) {
        const { data: tenant } = await supabase.from('tenants').select('plan, mrr_eur').eq('id', tenantId).single()
        const fromPlan = tenant?.plan ?? 'free'
        const fromMrr  = tenant?.mrr_eur ?? 0
        const toMrr    = PLAN_LIMITS[planId]?.mrr ?? 0

        await applyPlan(tenantId, planId)

        if (fromPlan !== planId) {
          await logSubscriptionEvent(supabase, {
            tenantId,
            eventType:     toMrr > fromMrr ? 'upgraded' : 'downgraded',
            fromPlan,
            toPlan:        planId,
            mrrDelta:      toMrr - fromMrr,
            mrrAfter:      toMrr,
            stripeEventId: event.id,
          })
        }
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub      = event.data.object as any
      const tenantId = sub.metadata?.tenant_id

      if (tenantId) {
        const { data: tenant } = await supabase.from('tenants').select('plan, mrr_eur').eq('id', tenantId).single()
        const fromMrr = tenant?.mrr_eur ?? 0

        await supabase.from('tenants').update({
          plan:               'free',
          plan_scans_limit:   3,
          plan_tokens_limit:  200_000,
          plan_targets_limit: 1,
          mrr_eur:            0,
          cancelled_at:       new Date().toISOString(),
          stripe_subscription_id: null,
        }).eq('id', tenantId)

        await logSubscriptionEvent(supabase, {
          tenantId,
          eventType:     'cancelled',
          fromPlan:      tenant?.plan,
          toPlan:        'free',
          mrrDelta:      -fromMrr,
          mrrAfter:      0,
          stripeEventId: event.id,
        })
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as any
      const tenantId = invoice.metadata?.tenant_id

      if (tenantId) {
        await supabase.from('tenants').update({ payment_failed: true }).eq('id', tenantId)
        await logSubscriptionEvent(supabase, {
          tenantId,
          eventType:        'payment_failed',
          stripeEventId:    event.id,
          stripeInvoiceId:  invoice.id,
        })
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as any
      const tenantId = invoice.metadata?.tenant_id

      if (tenantId) {
        // Clear any payment_failed flag on recovery
        await supabase.from('tenants').update({ payment_failed: false }).eq('id', tenantId)

        // Accumulate lifetime revenue
        const amountEur = (invoice.amount_paid ?? 0) / 100
        if (amountEur > 0) {
          const { data: t } = await supabase.from('tenants').select('lifetime_revenue_eur').eq('id', tenantId).single()
          await supabase.from('tenants').update({
            lifetime_revenue_eur: (t?.lifetime_revenue_eur ?? 0) + amountEur,
          }).eq('id', tenantId)
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
