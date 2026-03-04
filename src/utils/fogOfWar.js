// Fog of War — score-to-language conversion following the design document

const CONFIDENCE_NOISE = {
  HIGH: 5,
  MODERATE: 12,
  LOW: 22,
  VERY_LOW: 35,
}

const BANDS = [
  { threshold: 90, labels: {
    military: 'Overwhelming dominance',
    economic: 'Abundant reserves',
    information: 'Total narrative control',
    political: 'Unassailable standing',
    covert: 'Deep penetration',
  }},
  { threshold: 75, labels: {
    military: 'Strong and ready',
    economic: 'Robust and resilient',
    information: 'Clear advantage',
    political: 'Strong alliances',
    covert: 'Well-established networks',
  }},
  { threshold: 60, labels: {
    military: 'Capable with gaps',
    economic: 'Stable with pressures',
    information: 'Contested but ahead',
    political: 'Reliable but strained',
    covert: 'Active but exposed',
  }},
  { threshold: 45, labels: {
    military: 'Degraded, manageable',
    economic: 'Under strain',
    information: 'Parity, losing ground',
    political: 'Weakened relationships',
    covert: 'Thin coverage',
  }},
  { threshold: 30, labels: {
    military: 'Significantly weakened',
    economic: 'Serious shortfalls',
    information: 'Falling behind',
    political: 'Isolated',
    covert: 'Compromised assets',
  }},
  { threshold: 15, labels: {
    military: 'Critical deficiencies',
    economic: 'Near crisis',
    information: 'Suppressed',
    political: 'Near collapse',
    covert: 'Largely neutralised',
  }},
  { threshold: 0, labels: {
    military: 'Combat ineffective',
    economic: 'Economic collapse',
    information: 'Silenced',
    political: 'Failed state signals',
    covert: 'Blind',
  }},
]

export function scoreToLabel(score, dimension) {
  const clamped = Math.max(0, Math.min(100, score))
  for (const band of BANDS) {
    if (clamped >= band.threshold) return band.labels[dimension]
  }
  return BANDS[BANDS.length - 1].labels[dimension]
}

export function scoreWithNoise(score, confidence) {
  const sigma = CONFIDENCE_NOISE[confidence] ?? CONFIDENCE_NOISE.MODERATE
  const noise = gaussianRandom(0, sigma)
  return Math.max(0, Math.min(100, score + noise))
}

function gaussianRandom(mean, std) {
  // Box-Muller transform
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + std * z
}

// Build the intelligence brief shown to the AI/player for the adversary
export function buildIntelBrief(adversaryPower, intelligenceAccuracy) {
  const dimensions = ['military', 'economic', 'information', 'political', 'covert']
  const brief = {}
  for (const dim of dimensions) {
    const confidence = intelligenceAccuracy[dim]
    const noisyScore = scoreWithNoise(adversaryPower[dim], confidence)
    brief[dim] = {
      descriptor: scoreToLabel(noisyScore, dim),
      confidence,
    }
  }
  return brief
}

// Build your own state brief (self-knowledge, mostly accurate with some uncertainty in covert/ongoing ops)
export function buildSelfBrief(power) {
  const dimensions = ['military', 'economic', 'information', 'political', 'covert']
  const brief = {}
  for (const dim of dimensions) {
    brief[dim] = {
      descriptor: scoreToLabel(power[dim], dim),
      score: power[dim], // Player sees own actual score
    }
  }
  return brief
}

export function getScoreBand(score) {
  if (score >= 75) return 'high'
  if (score >= 50) return 'medium'
  if (score >= 25) return 'low'
  return 'critical'
}

// Compute intelligence accuracy from covert power balance
export function computeIntelligenceAccuracy(yourCP, adversaryCP) {
  const delta = yourCP - adversaryCP
  const dimensions = ['military', 'economic', 'information', 'political', 'covert']
  const base = delta >= 20 ? 'HIGH' : delta >= -5 ? 'MODERATE' : delta >= -25 ? 'LOW' : 'VERY_LOW'

  // Covert is always hardest to assess
  return {
    military: base,
    economic: base === 'HIGH' ? 'MODERATE' : base,
    information: base,
    political: base === 'HIGH' ? 'MODERATE' : base,
    covert: base === 'HIGH' ? 'MODERATE' : base === 'MODERATE' ? 'LOW' : 'VERY_LOW',
  }
}

export const CONFLICT_PHASES = [
  'Concealed Origination',
  'Escalation',
  'Outbreak of Conflict Activity',
  'Crisis',
  'Resolution',
  'Restoration of Peace',
]

export function getConflictPhase(domainLevels) {
  const max = Math.max(
    domainLevels.non_military,
    domainLevels.information,
    domainLevels.military,
  )
  if (max <= 1) return 0
  if (max <= 3) return 1
  if (max <= 5) return 2
  if (max <= 7) return 3
  if (max <= 9) return 4
  return 5
}
