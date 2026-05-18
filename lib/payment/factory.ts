// portal/lib/payment/factory.ts
import { stripeProvider } from './providers/stripe'
import { payfastProvider } from './providers/payfast'
import type { PaymentProvider } from './types'

export function getProviderForRegion(region: string | null | undefined): PaymentProvider {
  if (region === 'za') return payfastProvider
  return stripeProvider
}
