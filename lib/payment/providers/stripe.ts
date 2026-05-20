import { getStripe } from '@/lib/stripe'
import type { PaymentProvider, CheckoutParams, CheckoutResult } from '../types'

export const stripeProvider: PaymentProvider = {
  name: 'stripe',

  async createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
    const stripe = getStripe()

    let customerId = params.existingCustomerId
    if (customerId === null) {
      const customer = await stripe.customers.create({
        email: params.customerEmail,
        ...(params.customerName != null ? { name: params.customerName } : {}),
        metadata: { tenant_id: params.tenantId },
      })
      customerId = customer.id
    }

    // Append session_id safely — use & if successUrl already has a query string
    const sessionIdSuffix = params.successUrl.includes('?')
      ? '&session_id={CHECKOUT_SESSION_ID}'
      : '?session_id={CHECKOUT_SESSION_ID}'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: params.providerPriceId, quantity: 1 }],
      success_url: `${params.successUrl}${sessionIdSuffix}`,
      cancel_url: params.cancelUrl,
      subscription_data: {
        metadata: { tenant_id: params.tenantId, package_id: params.packageId },
        ...(params.trialDays && params.trialDays > 0
          ? { trial_period_days: params.trialDays }
          : {}),
      },
      metadata: { tenant_id: params.tenantId, package_id: params.packageId },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: { address: 'auto' },
    })

    if (!session.url) throw new Error('Stripe did not return a session URL')
    return { url: session.url, customerId }
  },
}
