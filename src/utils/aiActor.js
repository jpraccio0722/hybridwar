// Rule-based AI actor — simulates an LLM-driven state actor
// Doctrine types: 'aggressive', 'defensive', 'hybrid'

import actionsData from '../data/actions.json'
import { computeRiskProfile } from './resolver'

const DOCTRINE_WEIGHTS = {
  aggressive: {
    non_military: 0.8,
    information: 1.0,
    military: 1.4,
    de_escalation: 0.1,
    risk_tolerance: 1.3,
  },
  defensive: {
    non_military: 1.0,
    information: 1.2,
    military: 0.6,
    de_escalation: 1.5,
    risk_tolerance: 0.7,
  },
  hybrid: {
    non_military: 1.1,
    information: 1.1,
    military: 0.9,
    de_escalation: 0.6,
    risk_tolerance: 1.0,
  },
}

// Generate randomised doctrine weights at game start — stored in adversary state
// so the same personality persists for the whole game.
export function generateDoctrineWeights(doctrine) {
  const base = DOCTRINE_WEIGHTS[doctrine] ?? DOCTRINE_WEIGHTS.hybrid

  function jitter(value, range, min = 0.1, max = 2.0) {
    return Math.min(max, Math.max(min, value + (Math.random() * 2 - 1) * range))
  }

  return {
    non_military:   jitter(base.non_military,   0.30),
    information:    jitter(base.information,     0.30),
    military:       jitter(base.military,        0.40),
    de_escalation:  jitter(base.de_escalation,   0.25, 0.05),
    risk_tolerance: jitter(base.risk_tolerance,  0.30, 0.30, 1.8),
  }
}

export function aiSelectAction(adversaryState, playerState, intelligenceAccuracy) {
  const doctrine = adversaryState.doctrine ?? 'hybrid'
  // Use pre-generated weights if available (set at game start), otherwise fall back to fixed
  const weights = adversaryState.doctrine_weights ?? DOCTRINE_WEIGHTS[doctrine] ?? DOCTRINE_WEIGHTS.hybrid

  // Filter available actions
  const available = getAvailableActions(adversaryState, playerState)

  if (available.length === 0) {
    return { action: null, reasoning: 'No viable actions available this turn.' }
  }

  // Score each action
  const scored = available.map(action => ({
    action,
    score: scoreAction(action, adversaryState, playerState, weights),
  }))

  // Sort by score, add noise for unpredictability
  const withNoise = scored.map(({ action, score }) => ({
    action,
    score: score * (0.8 + Math.random() * 0.4), // ±20% randomness
  }))

  withNoise.sort((a, b) => b.score - a.score)

  // Pick from top 3 weighted
  const topN = withNoise.slice(0, 3)
  const totalScore = topN.reduce((s, x) => s + Math.max(0.01, x.score), 0)
  let roll = Math.random() * totalScore
  let chosen = topN[0]
  for (const item of topN) {
    roll -= Math.max(0.01, item.score)
    if (roll <= 0) {
      chosen = item
      break
    }
  }

  const reasoning = generateReasoning(chosen.action, adversaryState, playerState, doctrine)

  return { action: chosen.action, reasoning }
}

function getAvailableActions(actor, adversary) {
  return actionsData.filter(action => {
    // Domain level check
    const currentLevel = actor.domain_levels[action.domain] ?? 0
    const minLevel = action.min_level ?? 0

    // For de-escalation actions, need to be at or above the de-escalation level
    if (action.de_escalation) {
      const absLevel = Math.abs(action.escalates_to)
      return currentLevel >= absLevel
    }

    // Escalation: must be at min_level - 1 or above (can't skip levels)
    if (minLevel > 0 && currentLevel < minLevel - 1) return false

    // Power requirements
    if (action.min_power) {
      for (const [dim, req] of Object.entries(action.min_power)) {
        if ((actor.power[dim] ?? 0) < req) return false
      }
    }

    // Can't exceed level 8
    if (action.escalates_to > 8) return false

    // Don't repeat ongoing ops unless cancelled
    if (action.ongoing) {
      const alreadyRunning = actor.active_operations?.some(op => op.id === action.id)
      if (alreadyRunning) return false
    }

    return true
  })
}

function scoreAction(action, actor, adversary, weights) {
  let score = 0

  // Base effect score — how much does this hurt the adversary?
  const effectTotal = sumPowerImpact(action.enemy_effect ?? {}, adversary)
  score += effectTotal * 1.5

  // Self cost — how much do I spend?
  const costTotal = sumPowerImpact(action.self_cost ?? {}, actor)
  score -= costTotal * 0.8

  // Ongoing benefit (multi-turn value)
  if (action.ongoing) {
    const ongoingEffect = sumPowerImpact(action.ongoing_enemy_effect ?? {}, adversary)
    score += ongoingEffect * 2.0 // multi-turn value
  }

  // Forced costs on adversary
  if (action.forced_enemy_cost) {
    const forced = sumValues(action.forced_enemy_cost)
    score += forced * 1.2
  }

  // Doctrine domain preference
  const domainWeight = weights[action.domain] ?? 1.0
  score *= domainWeight

  // De-escalation penalty/bonus based on doctrine
  if (action.de_escalation) {
    score *= weights.de_escalation

    // Prefer de-escalation when losing badly
    const selfStrength = averagePower(actor)
    const adversaryStrength = averagePower(adversary)
    if (selfStrength < adversaryStrength * 0.7) {
      score *= 2.0 // Escalate de-escalation desire when weak
    }
  }

  // Risk adjustment — attribution risk can be costly
  if (action.attribution_risk > 0) {
    score -= action.attribution_risk * 30 * (1 / weights.risk_tolerance)
  }

  if (action.counter_strike_risk > 0) {
    score -= action.counter_strike_risk * 20 * (1 / weights.risk_tolerance)
  }

  // Operational risk — penalise actions where adversary dominates the relevant domain.
  // Aggressive doctrines accept more risk; defensive ones avoid it.
  if (!action.de_escalation) {
    const { riskLevel } = computeRiskProfile(action, actor, adversary)
    const basePenalty = { low: 0, moderate: 0.08, high: 0.32, extreme: 0.62 }[riskLevel] ?? 0
    // risk_tolerance (1.3 aggressive, 0.7 defensive) scales how much the penalty hurts
    const adjustedPenalty = basePenalty / Math.max(0.5, weights.risk_tolerance)
    score *= Math.max(0.05, 1 - adjustedPenalty)
  }

  // Strategic targeting — focus on adversary's weakest dimensions
  const weakestDim = getWeakestDimension(adversary)
  if (action.enemy_effect?.[weakestDim]) {
    score *= 1.3
  }

  // Self-preservation — avoid actions that drain already-weak dimensions
  for (const dim of Object.keys(action.self_cost ?? {})) {
    if ((actor.power[dim] ?? 100) < 30) {
      score *= 0.3 // Heavy penalty for draining critical resources
    }
  }

  return Math.max(0, score)
}

function sumPowerImpact(effects, state) {
  let total = 0
  for (const [dim, amount] of Object.entries(effects)) {
    // Weight effect higher if it hits an already-weak dimension
    const currentPower = state.power[dim] ?? 50
    const urgencyMultiplier = currentPower < 40 ? 1.4 : 1.0
    total += amount * urgencyMultiplier
  }
  return total
}

function sumValues(obj) {
  return Object.values(obj).reduce((s, v) => s + v, 0)
}

function averagePower(state) {
  const vals = Object.values(state.power)
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

function getWeakestDimension(state) {
  let weakest = 'economic'
  let minVal = Infinity
  for (const [dim, val] of Object.entries(state.power)) {
    if (val < minVal) {
      minVal = val
      weakest = dim
    }
  }
  return weakest
}

function generateReasoning(action, actor, adversary, doctrine) {
  const doctrineLabels = {
    aggressive: 'Escalation-dominant doctrine dictates maximum pressure.',
    defensive: 'Defensive posture requires preserving capacity while managing escalation.',
    hybrid: 'Multi-domain hybrid approach — this action opens combined-arms pressure.',
  }

  const doctrineNote = doctrineLabels[doctrine] ?? ''
  const weakest = getWeakestDimension(adversary)

  return `${doctrineNote} Adversary ${weakest} appears exploitable. Action selected to apply sustainable pressure.`
}

// Export for use in action filtering in the UI
export { getAvailableActions }
