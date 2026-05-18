// portal/app/api/webhooks/payfast/route.ts
// Phase 2: PayFast Instant Transaction Notification (ITN) handler
// Docs: https://developers.payfast.co.za/docs#step_3_confirm_payment
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest) {
  // Phase 2 implementation:
  // 1. Validate ITN signature (HMAC-MD5 of sorted query string)
  // 2. Confirm payment status === 'COMPLETE'
  // 3. Call applyPackageToTenant(tenantId, packageId, 'payfast', pf_payment_id)
  return NextResponse.json({ received: true })
}
