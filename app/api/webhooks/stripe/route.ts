import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { applyPackageToTenant, revertTenantToFree } from '@/lib/payment/apply-package'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')!

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = adminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session   = event.data.object as any
      const tenantId  = session.metadata?.tenant_id
      const packageId = session.metadata?.package_id

      if (tenantId && packageId) {
        await applyPackageToTenant(tenantId, packageId, 'stripe', session.subscription, event.id)
        if (session.customer) {
          await db.from('tenants').update({
            stripe_customer_id:     session.customer,
            stripe_subscription_id: session.subscription,
          }).eq('id', tenantId)
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub       = event.data.object as any
      const tenantId  = sub.metadata?.tenant_id
      const packageId = sub.metadata?.package_id

      if (tenantId && packageId && (sub.status === 'active' || sub.status === 'trialing')) {
        await applyPackageToTenant(tenantId, packageId, 'stripe', sub.id, event.id)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub      = event.data.object as any
      const tenantId = sub.metadata?.tenant_id

      if (tenantId) {
        const { data: tenant } = await db
          .from('tenants').select('plan, mrr_eur').eq('id', tenantId).single()
        await revertTenantToFree(tenantId, tenant?.plan ?? 'free', tenant?.mrr_eur ?? 0, event.id)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice  = event.data.object as any
      const tenantId = invoice.metadata?.tenant_id
      if (tenantId) {
        await db.from('tenants').update({ payment_failed: true }).eq('id', tenantId)
        await db.from('subscription_events').insert({
          tenant_id:         tenantId,
          event_type:        'payment_failed',
          stripe_event_id:   event.id,
          stripe_invoice_id: invoice.id,
        })
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice  = event.data.object as any
      const tenantId = invoice.metadata?.tenant_id
      if (tenantId) {
        await db.from('tenants').update({ payment_failed: false }).eq('id', tenantId)
        const amountEur = (invoice.amount_paid ?? 0) / 100
        if (amountEur > 0) {
          const { data: t } = await db.from('tenants').select('lifetime_revenue_eur').eq('id', tenantId).single()
          await db.from('tenants').update({
            lifetime_revenue_eur: (t?.lifetime_revenue_eur ?? 0) + amountEur,
          }).eq('id', tenantId)
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
