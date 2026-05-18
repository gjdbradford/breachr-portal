// portal/lib/payment/types.ts

export type Region        = 'eu' | 'za'
export type ProviderName  = 'stripe' | 'payfast'
export type BillingPeriod = 'monthly' | 'annual'

export interface CheckoutParams {
  packageId:          string       // Supabase packages.id (UUID)
  period:             BillingPeriod
  providerPriceId:    string       // provider-specific price reference (e.g. Stripe price_xxx)
  tenantId:           string
  customerEmail:      string
  customerName:       string | null
  existingCustomerId: string | null // provider-specific customer ref already on tenant
  successUrl:         string
  cancelUrl:          string
}

export interface CheckoutResult {
  url:        string  // redirect the user here
  customerId: string  // provider customer ID — persist to tenants after checkout
}

export interface PaymentProvider {
  readonly name: ProviderName
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult>
}
