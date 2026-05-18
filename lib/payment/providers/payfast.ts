import type { PaymentProvider, CheckoutParams, CheckoutResult } from '../types'

export class PayFastNotImplementedError extends Error {
  readonly statusCode = 503
  constructor() {
    super('PayFast payment integration is not yet available. Please contact support.')
  }
}

export const payfastProvider: PaymentProvider = {
  name: 'payfast',

  async createCheckoutSession(_params: CheckoutParams): Promise<CheckoutResult> {
    throw new PayFastNotImplementedError()
  },
}
