import { getStripe } from '@/lib/stripe'
import type { PaymentProvider, CheckoutParams, CheckoutResult } from '../types'

export const stripeProvider: PaymentProvider = {
  name: 'stripe',

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
    const stripe = getStripe()

    let customerId = params.existingCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: params.customerEmail,
        ...(params.customerName ? { name: params.customerName } : {}),
        metadata: { tenant_id: params.tenantId },
      })
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: params.providerPriceId, quantity: 1 }],
      success_url: `${params.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: params.cancelUrl,
      subscription_data: {
        metadata: { tenant_id: params.tenantId, package_id: params.packageId },
      },
      metadata: { tenant_id: params.tenantId, package_id: params.packageId },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: { address: 'auto' },
    })

    return { url: session.url!, customerId }
  },
}
