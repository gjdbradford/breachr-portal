import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendNewDeviceAlert } from '@/lib/email'

// ─── Mock Resend ──────────────────────────────────────────────────────────
// vi.mock factories are hoisted before variable declarations, so mockSend
// must be declared with vi.hoisted() to be available inside the factory.
// The Resend constructor must also be a regular function, not an arrow
// function, since arrow functions cannot be used with `new`.

const mockSend = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'email-123' }))

vi.mock('resend', () => ({
  // eslint-disable-next-line prefer-arrow-callback
  Resend: vi.fn(function () {
    return { emails: { send: mockSend } }
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockSend.mockResolvedValue({ id: 'email-123' })
  process.env.RESEND_API_KEY = 'test-resend-key'
})

// ─── Tests ────────────────────────────────────────────────────────────────

const BASE = {
  to:        'user@example.com',
  deviceIp:  '192.168.1.50',
  deviceMac: 'aa:bb:cc:dd:ee:ff',
  assetId:   'asset-uuid-123',
}

describe('sendNewDeviceAlert', () => {
  it('does nothing when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY
    await sendNewDeviceAlert(BASE)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sends an email when RESEND_API_KEY is set', async () => {
    await sendNewDeviceAlert(BASE)
    expect(mockSend).toHaveBeenCalledOnce()
  })

  it('sends to the correct recipient', async () => {
    await sendNewDeviceAlert({ ...BASE, to: 'security@corp.com' })
    expect(mockSend.mock.calls[0][0].to).toBe('security@corp.com')
  })

  it('uses hostname in the subject when provided', async () => {
    await sendNewDeviceAlert({ ...BASE, deviceHostname: 'my-laptop.local' })
    expect(mockSend.mock.calls[0][0].subject).toContain('my-laptop.local')
  })

  it('falls back to IP in subject when no hostname', async () => {
    await sendNewDeviceAlert(BASE)
    expect(mockSend.mock.calls[0][0].subject).toContain('192.168.1.50')
  })

  it('includes IP, MAC, vendor and asset link in HTML body', async () => {
    await sendNewDeviceAlert({ ...BASE, deviceVendor: 'Apple Inc' })
    const { html } = mockSend.mock.calls[0][0]
    expect(html).toContain('192.168.1.50')
    expect(html).toContain('aa:bb:cc:dd:ee:ff')
    expect(html).toContain('Apple Inc')
    expect(html).toContain('asset-uuid-123')
  })

  it('includes sensor name in body when provided', async () => {
    await sendNewDeviceAlert({ ...BASE, sensorName: 'Office London' })
    expect(mockSend.mock.calls[0][0].html).toContain('Office London')
  })

  it('sends from the Breachr alerts address', async () => {
    await sendNewDeviceAlert(BASE)
    expect(mockSend.mock.calls[0][0].from).toContain('alerts@breachr.io')
  })
})
