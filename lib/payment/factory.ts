// portal/lib/payment/factory.ts
import { stripeProvider } from './providers/stripe'
import type { PaymentProvider } from './types'

export function getProviderForRegion(_region: string | null | undefined): PaymentProvider {
  return stripeProvider
}
