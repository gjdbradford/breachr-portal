'use client'

import { useEffect } from 'react'

export default function AuditLogger({
  action,
  detail,
}: {
  action: string
  detail: Record<string, unknown>
}) {
  useEffect(() => {
    fetch('/api/audit/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, detail }),
    }).catch(() => {})
  }, [])

  return null
}
