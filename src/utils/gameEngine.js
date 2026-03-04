// Core game loop — regeneration, thresholds, win conditions

import actionsData from '../data/actions.json'

// Power regeneration per turn (base rates from design doc)
const BASE_REGEN = {
  economic: 5,
  military: 4,
  information: 3,
  political: 2,
  covert: 3,
}

const MAX_POWER = 100

export function applyRegeneration(power, activeOps, domainLevels) {
  const newPower = { ...power }

  // Base regeneration
  for (const [dim, rate] of Object.entries(BASE_REGEN)) {
    newPower[dim] = Math.min(MAX_POWER, newPower[dim] + rate)
  }

  // Modifiers from active operations
  const hasWarEconomy = activeOps.some(op => op.id === 'economic_blockade' && op.isEnforced)
  if (hasWarEconomy) {
    newPower.economic = Math.max(0, newPower.economic - 3)
    newPower.military = Math.min(MAX_POWER, newPower.military + 6)
  }

  const hasInfoDominance = activeOps.some(op => op.id === 'info_dominance')
  if (hasInfoDominance) {
    newPower.information = Math.min(MAX_POWER, newPower.information + 4)
  }

  // High conflict drains regeneration
  if (domainLevels.military >= 7) {
    newPower.economic = Math.max(0, newPower.economic - 3)
    newPower.political = Math.max(0, newPower.political - 2)
  }

  // Low political power reduces economic regen (instability)
  if (power.political < 20) {
    newPower.economic = Math.max(0, newPower.economic - 2)
  }

  return newPower
}

export function applyPowerDelta(power, delta) {
  const newPower = { ...power }
  for (const [dim, amount] of Object.entries(delta)) {
    newPower[dim] = Math.max(0, Math.min(MAX_POWER, newPower[dim] - amount))
  }
  return newPower
}

export function applyPowerGain(power, delta) {
  const newPower = { ...power }
  for (const [dim, amount] of Object.entries(delta)) {
    newPower[dim] = Math.max(0, Math.min(MAX_POWER, newPower[dim] + amount))
  }
  return newPower
}

export function updateDomainLevel(currentLevels, domain, escalatesTo) {
  if (escalatesTo < 0) {
    // De-escalation: reduce by 1-2
    const reduction = Math.abs(escalatesTo) >= 5 ? 2 : 1
    return {
      ...currentLevels,
      [domain]: Math.max(0, currentLevels[domain] - reduction),
    }
  }
  return {
    ...currentLevels,
    [domain]: Math.max(currentLevels[domain], escalatesTo),
  }
}

// Check threshold cascade events from the design document
export function checkThresholdCascades(playerState, adversaryState) {
  const events = []
  const pl = playerState.domain_levels
  const ad = adversaryState.domain_levels

  // Military > 6 AND Information > 5 → alliance activation check
  if (pl.military > 6 && pl.information > 5) {
    if (Math.random() < 0.4) {
      events.push({
        type: 'alliance_activation',
        severity: 'warning',
        message: 'THRESHOLD EVENT: Military and information escalation has triggered an alliance activation check. Adversary may be securing commitments from external partners.',
      })
    }
  }

  // Non-military > 7 AND Military < 3 → grey zone attribution pressure
  if (pl.non_military > 7 && pl.military < 3) {
    events.push({
      type: 'attribution_pressure',
      severity: 'info',
      message: 'GREY ZONE WARNING: Sustained non-military pressure without military cover is drawing international scrutiny. Attribution pressure is increasing.',
    })
  }

  // All domains > 5 simultaneously → adversary despair check
  if (pl.non_military > 5 && pl.information > 5 && pl.military > 5) {
    if (Math.random() < 0.3) {
      events.push({
        type: 'despair_check',
        severity: 'success',
        message: 'STRATEGIC ASSESSMENT: Total multi-domain pressure has crossed a threshold. Adversary decision-makers are assessing their position as increasingly untenable.',
      })
    }
  }

  // Any domain > 8 → irreversibility warning
  for (const [domain, level] of Object.entries(pl)) {
    if (level > 8) {
      events.push({
        type: 'irreversibility',
        severity: 'danger',
        message: `IRREVERSIBILITY WARNING: ${formatDomain(domain)} escalation has passed level 8. Actions in this domain are becoming very difficult to walk back.`,
      })
    }
  }

  // Adversary-side checks (their escalation affecting you)
  if (ad.military > 6 && adversaryState.power.military > 60) {
    if (Math.random() < 0.35) {
      events.push({
        type: 'adversary_posture',
        severity: 'warning',
        message: 'INTELLIGENCE ALERT: Adversary military posture has reached an elevated threshold. Forward indicators suggest increased readiness.',
      })
    }
  }

  return events
}

function formatDomain(d) {
  return d === 'non_military' ? 'Non-Military' :
    d.charAt(0).toUpperCase() + d.slice(1)
}

// Evaluate a single scenario win condition
function evaluateCondition(cond, playerState, adversaryState, turn) {
  const ap = adversaryState.power
  const pp = playerState.power

  switch (cond.check) {
    case 'adversary_dim_below':
      return ap[cond.dim] < cond.threshold

    case 'adversary_multi_below':
      return cond.dims.every((dim, i) => ap[dim] < cond.thresholds[i])

    case 'adversary_dims_critical': {
      const count = Object.values(ap).filter(v => v < cond.threshold).length
      return count >= cond.min_count
    }

    case 'player_dim_below':
      return pp[cond.dim] < cond.threshold

    case 'player_multi_below':
      return cond.dims.every((dim, i) => pp[dim] < cond.thresholds[i])

    case 'player_dims_critical': {
      const count = Object.values(pp).filter(v => v < cond.threshold).length
      return count >= cond.min_count
    }

    case 'adversary_survive_turns': {
      if (turn < cond.min_turn) return false
      const avgAdversary = Object.values(ap).reduce((s, v) => s + v, 0) / Object.values(ap).length
      return avgAdversary >= cond.min_avg
    }

    case 'adversary_outlasts_player': {
      if (turn < cond.min_turn) return false
      const avgAdversary = Object.values(ap).reduce((s, v) => s + v, 0) / Object.values(ap).length
      const avgPlayer = Object.values(pp).reduce((s, v) => s + v, 0) / Object.values(pp).length
      return avgAdversary >= avgPlayer
    }

    default:
      return false
  }
}

// Win/lose condition check
// winConditions: scenario.win_conditions — { player: [...], adversary: [...] }
export function checkWinConditions(playerState, adversaryState, turn, winConditions) {
  // Grace period — no win/loss before turn 4
  if (turn < 4) return { over: false }

  if (winConditions) {
    // Check player win conditions
    for (const cond of winConditions.player) {
      if (evaluateCondition(cond, playerState, adversaryState, turn)) {
        return {
          over: true,
          winner: 'player',
          conditionId: cond.id,
          conditionLabel: cond.label,
          reason: cond.resolution_text,
        }
      }
    }

    // Check adversary win conditions
    for (const cond of winConditions.adversary) {
      if (evaluateCondition(cond, playerState, adversaryState, turn)) {
        return {
          over: true,
          winner: 'adversary',
          conditionId: cond.id,
          conditionLabel: cond.label,
          reason: cond.resolution_text,
        }
      }
    }
  } else {
    // Fallback generic conditions (no scenario win_conditions defined)
    const playerCritical = countCriticalDimensions(playerState.power)
    if (playerCritical >= 2) {
      return {
        over: true,
        winner: 'adversary',
        reason: 'Your state has suffered critical collapse across multiple power dimensions. The adversary has achieved strategic dominance.',
      }
    }
    const adversaryCritical = countCriticalDimensions(adversaryState.power)
    if (adversaryCritical >= 2) {
      return {
        over: true,
        winner: 'player',
        reason: 'Adversary power has collapsed across multiple dimensions. Strategic objectives achieved.',
      }
    }
    if (adversaryState.power.economic < 10) {
      return { over: true, winner: 'player', reason: 'Adversary state has suffered economic collapse. Political will to continue has evaporated.' }
    }
    if (playerState.power.economic < 10) {
      return { over: true, winner: 'adversary', reason: 'Your economy has collapsed. The state can no longer sustain the conflict.' }
    }
    if (adversaryState.power.political < 10) {
      return { over: true, winner: 'player', reason: 'Adversary has been comprehensively isolated. Continued resistance is futile.' }
    }
    if (playerState.power.political < 10) {
      return { over: true, winner: 'adversary', reason: 'Your state has been politically isolated. Continued operations are untenable.' }
    }
    if (adversaryState.power.information < 12 && adversaryState.power.political < 20) {
      return { over: true, winner: 'player', reason: 'Adversary has reached strategic despair — narrative collapse combined with political isolation has broken the will to resist.' }
    }
  }

  // Turn limit — call it a draw after 20 turns
  if (turn >= 20) {
    const pScore = averagePower(playerState)
    const aScore = averagePower(adversaryState)
    if (pScore > aScore + 10) {
      return {
        over: true,
        winner: 'player',
        conditionLabel: 'Marginal Strategic Advantage',
        reason: 'The conflict has reached its conclusion. Your sustained pressure campaign has achieved marginal strategic advantage — a difficult, conditional victory.',
      }
    } else if (aScore > pScore + 10) {
      return {
        over: true,
        winner: 'adversary',
        conditionLabel: 'Strategic Resilience',
        reason: 'After twenty turns, the adversary has maintained strategic resilience. Your campaign has failed to achieve decisive objectives.',
      }
    } else {
      return {
        over: true,
        winner: 'draw',
        reason: 'Twenty turns of hybrid conflict have produced no decisive victor. Both states have been weakened. A stalemate — with all its attendant risks.',
      }
    }
  }

  return { over: false }
}

function countCriticalDimensions(power) {
  return Object.values(power).filter(v => v < 15).length
}

function averagePower(state) {
  const vals = Object.values(state.power)
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

// Get available actions for a state (for player UI)
export function getAvailableActionsForState(state) {
  return actionsData.filter(action => {
    const currentLevel = state.domain_levels[action.domain] ?? 0
    const minLevel = action.min_level ?? 0

    if (action.de_escalation) {
      const absLevel = Math.abs(action.escalates_to)
      return currentLevel >= absLevel
    }

    // Must be at min_level - 1 or above (no level skipping; except level 0)
    if (minLevel > 0 && currentLevel < minLevel - 1) return false

    if (action.min_power) {
      for (const [dim, req] of Object.entries(action.min_power)) {
        if ((state.power[dim] ?? 0) < req) return false
      }
    }

    if (action.escalates_to > 8) return false

    if (action.ongoing) {
      const alreadyRunning = state.active_operations?.some(op => op.id === action.id)
      if (alreadyRunning) return false
    }

    return true
  })
}

// Add operation to active ops list
export function addActiveOperation(activeOps, action) {
  if (!action.ongoing) return activeOps
  const op = {
    id: action.id,
    name: action.name,
    domain: action.domain,
    ongoing_self_cost: action.ongoing_self_cost,
    ongoing_enemy_effect: action.ongoing_enemy_effect,
    forced_enemy_cost: action.forced_enemy_cost,
    turn_started: Date.now(),
  }
  return [...activeOps, op]
}

// Remove cancelled operations
export function cancelOperation(activeOps, actionId) {
  return activeOps.filter(op => op.id !== actionId)
}

export const DOMAIN_LABELS = {
  non_military: 'Non-Military',
  information: 'Information',
  military: 'Military',
}

export const POWER_LABELS = {
  military: 'Military Power',
  economic: 'Economic Power',
  information: 'Information Power',
  political: 'Political Power',
  covert: 'Covert Power',
}

// Strategic Advantage: weighted power differential, normalized to -100 → +100
// Higher weight on economic (funds all domains) and political (strategic will)
const ADVANTAGE_WEIGHTS = {
  military: 1.0,
  economic: 1.2,
  information: 1.0,
  political: 1.1,
  covert: 0.9,
}

// Max possible weighted score per actor = sum(weights) × 100 = 5.2 × 100 = 520
const ADVANTAGE_MAX = Object.values(ADVANTAGE_WEIGHTS).reduce((s, w) => s + w, 0) * 100

export function computeStrategicAdvantage(playerPower, adversaryPower) {
  let pScore = 0
  let aScore = 0
  for (const [dim, weight] of Object.entries(ADVANTAGE_WEIGHTS)) {
    pScore += (playerPower[dim] ?? 0) * weight
    aScore += (adversaryPower[dim] ?? 0) * weight
  }
  return Math.round(((pScore - aScore) / ADVANTAGE_MAX) * 100)
}

export function getAdvantageLabel(advantage) {
  if (advantage > 25) return 'Decisive Advantage'
  if (advantage > 10) return 'Clear Advantage'
  if (advantage > 3) return 'Slight Advantage'
  if (advantage >= -3) return 'Contested'
  if (advantage >= -10) return 'Slight Disadvantage'
  if (advantage >= -25) return 'Clear Disadvantage'
  return 'Critical Disadvantage'
}
