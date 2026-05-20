// portal/lib/payment/types.ts

export type Region        = 'eu' | 'row'
export type ProviderName  = 'stripe' | 'payfast'
export type BillingPeriod = 'monthly' | 'annual'

export interface CheckoutParams {
  packageId:          string
  period:             BillingPeriod
  providerPriceId:    string
  tenantId:           string
  customerEmail:      string
  customerName:       string | null
  existingCustomerId: string | null
  successUrl:         string
  cancelUrl:          string
  trialDays?:         number
}

export interface CheckoutResult {
  url:        string
  customerId: string
}

export interface PaymentProvider {
  readonly name: ProviderName
  createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult>
}
