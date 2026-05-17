'use client'

import { useRegisterHelpContent } from '@/lib/help-panel-context'

type AiMessage = { role: 'user' | 'assistant'; content: string; tokens: number; timestamp: string }

export default function RemediationHelpRegistrar({
  taskId,
  initialMessages,
  initialTokensUsed,
  initialDailyCount,
}: {
  taskId:             string
  initialMessages:    AiMessage[]
  initialTokensUsed:  number
  initialDailyCount:  number
}) {
  useRegisterHelpContent({
    title: 'AI Assist',
    defaultTab: 'chat',
    remediationTask: { taskId, initialMessages, initialTokensUsed, initialDailyCount },
  })
  return null
}
