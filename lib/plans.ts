export type PlanId = 'free' | 'starter' | 'professional' | 'enterprise'

export interface PlanConfig {
  id: PlanId
  label: string
  price: string
  priceMonthly: number          // EUR
  scansPerMonth: number | null  // null = unlimited
  targetsMax: number | null     // null = unlimited
  tokensPerMonth: number | null // null = unlimited
  scanTypes: string[]           // allowed scan_type values
  features: string[]
  color: string
  extraTokenPrice: string
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    label: 'Freemium',
    price: '€0',
    priceMonthly: 0,
    scansPerMonth: 3,
    targetsMax: 1,
    tokensPerMonth: 200_000,
    scanTypes: ['full'],
    extraTokenPrice: '€15 / 1M',
    color: '#64748b',
    features: [
      '1 target surface',
      '3 scans / month',
      'Full scan (OWASP Top 10)',
      '200K Claude tokens / month',
      'Live findings dashboard',
      'Cryptographic audit trail',
    ],
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    price: '€159',
    priceMonthly: 159,
    scansPerMonth: 20,
    targetsMax: 5,
    tokensPerMonth: 3_000_000,
    scanTypes: ['full', 'api'],
    extraTokenPrice: '€10 / 1M',
    color: '#22c55e',
    features: [
      '5 target surfaces',
      '20 scans / month',
      'Full + API scan types',
      '3M AI tokens / month',
      'Basic compliance reports',
      'Cryptographic audit trail per finding',
      'LLM transparency (EU AI Act)',
      'Email support',
    ],
  },
  professional: {
    id: 'professional',
    label: 'Professional',
    price: '€350',
    priceMonthly: 350,
    scansPerMonth: 50,
    targetsMax: 10,
    tokensPerMonth: 10_000_000,
    scanTypes: ['full', 'api'],
    extraTokenPrice: '€8 / 1M',
    color: '#42a5f5',
    features: [
      '10 target surfaces',
      '50 scans / month',
      'Full + API scan types',
      '10M Claude tokens / month',
      'BaFin / NCA compliance reports',
      'Full audit trail export',
      'Priority email support',
    ],
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    price: 'POA',
    priceMonthly: 15000,
    scansPerMonth: null,
    targetsMax: null,
    tokensPerMonth: 50_000_000,
    scanTypes: ['full', 'api', 'tlpt'],
    extraTokenPrice: 'Bundled',
    color: '#a78bfa',
    features: [
      'Unlimited targets',
      'Unlimited scans',
      'Full + API + TLPT (DORA Art.26)',
      '50M Claude tokens / month',
      'White-label compliance reports',
      'On-premise deployment option',
      'Regulatory partnership support',
      'Dedicated account manager',
    ],
  },
}

export function getPlan(id: string | null | undefined): PlanConfig {
  return PLANS[(id as PlanId) ?? 'free'] ?? PLANS.free
}

// Token cost in USD (Claude Sonnet 4.6 pricing)
export const TOKEN_COST_PER_M_INPUT  = 3.00
export const TOKEN_COST_PER_M_OUTPUT = 15.00

export function tokensToUsd(input: number, output: number): number {
  return (input * TOKEN_COST_PER_M_INPUT + output * TOKEN_COST_PER_M_OUTPUT) / 1_000_000
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}
