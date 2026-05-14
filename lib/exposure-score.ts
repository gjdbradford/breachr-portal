// lib/exposure-score.ts

export interface ExposureDimension {
  label: string
  weight: number   // positive number; normalised internally
  score: number    // 0–100
}

export function computeExposureScore(dimensions: ExposureDimension[]): number {
  if (dimensions.length === 0) return 0
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0)
  if (totalWeight === 0) return 0
  const raw = dimensions.reduce((sum, d) => sum + (d.score * d.weight) / totalWeight, 0)
  return Math.max(0, Math.min(100, Math.round(raw)))
}
