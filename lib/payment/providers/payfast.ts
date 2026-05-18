import type { PaymentProvider } from '../types'

export const payfastProvider: PaymentProvider = {
  name: 'payfast',
  async createCheckoutSession() { throw new Error('not implemented') },
}
