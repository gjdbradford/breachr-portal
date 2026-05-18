import type { PaymentProvider } from '../types'

export const stripeProvider: PaymentProvider = {
  name: 'stripe',
  async createCheckoutSession() { throw new Error('not implemented') },
}
