export const DEPLOYMENT_TYPES = [
  { id: 'docker',       label: 'Docker — Linux',    sub: 'Ubuntu, Debian, CentOS, any Linux host',   icon: '🐋' },
  { id: 'raspberry_pi', label: 'Raspberry Pi',       sub: 'Pi 3, 4, 5 — dedicated always-on sensor', icon: '🫐' },
  { id: 'synology',     label: 'Synology NAS',       sub: 'Container Manager (DSM 7+)',               icon: '💾' },
  { id: 'native',       label: 'Native Linux',       sub: 'systemd service, no Docker required',     icon: '⚙️' },
] as const

export type DeploymentType = typeof DEPLOYMENT_TYPES[number]['id']

export const VALID_DEPLOYMENT_TYPE_IDS = DEPLOYMENT_TYPES.map(dt => dt.id)
