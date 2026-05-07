'use client'
import type { DeploymentType } from '@/lib/sensor-types'

interface Props {
  deploymentType: DeploymentType
  sensor?: {
    id: string
    status: string
    last_seen: string | null
    deployment_type: string
  }
}

export default function SensorHelpChat(_: Props) {
  return null
}
