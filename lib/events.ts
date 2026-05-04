'use client'

// Product event names — all events tracked in the `events` table
export const EVENTS = {
  // Auth
  USER_REGISTERED:        'user.registered',
  USER_LOGGED_IN:         'user.logged_in',
  USER_LOGGED_OUT:        'user.logged_out',

  // Onboarding
  ONBOARDING_STARTED:     'onboarding.started',
  ONBOARDING_COMPLETED:   'onboarding.completed',

  // Targets
  TARGET_CREATED:         'target.created',
  TARGET_DELETED:         'target.deleted',

  // Scans
  SCAN_LAUNCHED:          'scan.launched',
  SCAN_COMPLETED:         'scan.completed',
  SCAN_FAILED:            'scan.failed',
  SCAN_RESYNC:            'scan.resync',

  // Findings
  FINDING_VIEWED:         'finding.viewed',
  FINDING_STATUS_CHANGED: 'finding.status_changed',
  FINDING_FALSE_POSITIVE: 'finding.false_positive',

  // Reports
  REPORT_VIEWED:          'report.viewed',
  REPORT_DOWNLOADED:      'report.downloaded',

  // Audit
  AUDIT_TRAIL_VIEWED:     'audit.trail_viewed',
  AUDIT_ENTRY_VERIFIED:   'audit.entry_verified',

  // Billing
  UPGRADE_PAGE_VIEWED:    'billing.upgrade_page_viewed',
  CHECKOUT_STARTED:       'billing.checkout_started',
  PLAN_UPGRADED:          'billing.plan_upgraded',
  PLAN_CANCELLED:         'billing.plan_cancelled',
  PORTAL_OPENED:          'billing.portal_opened',

  // Navigation
  PAGE_VIEW:              'page.view',
  MODULE_CLICKED:         'module.clicked',

  // Saved views
  SAVED_VIEW_CREATED:     'saved_view.created',
  SAVED_VIEW_APPLIED:     'saved_view.applied',
} as const

export type EventName = typeof EVENTS[keyof typeof EVENTS]

let _sessionId: string | null = null

function getSessionId(): string {
  if (_sessionId) return _sessionId
  if (typeof window === 'undefined') return ''
  const key = 'brch_sid'
  let sid = sessionStorage.getItem(key)
  if (!sid) {
    sid = crypto.randomUUID()
    sessionStorage.setItem(key, sid)
  }
  _sessionId = sid
  return sid
}

export async function track(event: EventName, properties: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  try {
    await fetch('/api/events/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        properties,
        session_id: getSessionId(),
        url: window.location.pathname,
        referrer: document.referrer || undefined,
      }),
    })
  } catch {
    // never throw — telemetry must not break the product
  }
}
