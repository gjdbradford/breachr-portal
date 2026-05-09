'use client'

import { useEffect } from 'react'

export default function AcknowledgeOnMount({ assetId }: { assetId: string }) {
  useEffect(() => {
    fetch(`/api/assets/${assetId}/acknowledge`, { method: 'POST' }).catch(() => {})
  }, [assetId])
  return null
}
