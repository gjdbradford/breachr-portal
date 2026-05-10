import { createHmac, timingSafeEqual } from 'crypto'

export function hmacSha256Hex(key: string, data: string): string {
  return createHmac('sha256', Buffer.from(key, 'hex')).update(data, 'utf8').digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}
