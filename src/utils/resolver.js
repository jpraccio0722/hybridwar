// Action outcome resolver — probabilistic engine following the design document

const COST_SCALE = {
  minor: 10,
  moderate: 20,
  significant: 30,
  major: 45,
}

// Compute the operational risk profile for an action based on relative domain power.
// riskFactor > 1 means adversary has the advantage in that domain.
// Returns { riskLevel, riskFactor, costRange, effectRange }
// where costRange/effectRange are [min, max] multipliers on base values.
export function computeRiskProfile(action, actor, adversary) {
  // De-escalation actions are diplomatic — they don't carry operational combat risk
  if (action.de_escalation) {
    return { riskLevel: 'low', riskFactor: 0.5, costRange: [0.80, 1.10], effectRange: [1.0, 1.0] }
  }

  // The relevant power dimension drives operational risk for each domain
  const riskDim = {
    military: 'military',
    information: 'information',
    non_military: 'covert',
  }[action.domain] ?? 'covert'

  const actorPower = Math.max(actor.power[riskDim] ?? 50, 1)
  const adversaryPower = adversary.power[riskDim] ?? 50
  // riskFactor: 1.0 = parity, >1 = adversary stronger (higher risk), <1 = you stronger (low risk)
  const riskFactor = Math.max(0.3, adversaryPower / actorPower)

  let riskLevel, costRange, effectRange

  if (riskFactor < 0.7) {
    // Clear operational advantage — cheaper ops, more effective outcomes
    riskLevel = 'low'
    costRange = [0.70, 1.10]
    effectRange = [1.00, 1.50]
  } else if (riskFactor < 1.0) {
    // Slight advantage
    riskLevel = 'moderate'
    costRange = [0.85, 1.30]
    effectRange = [0.80, 1.25]
  } else if (riskFactor < 1.5) {
    // Adversary stronger — higher costs, reduced effectiveness
    riskLevel = 'high'
    costRange = [1.00, 1.70]
    effectRange = [0.40, 1.00]
  } else {
    // Heavily outmatched — potentially crippling costs, unreliable outcomes
    riskLevel = 'extreme'
    costRange = [1.30, 2.30]
    effectRange = [0.10, 0.60]
  }

  return { riskLevel, riskFactor, costRange, effectRange }
}

// Resolve an action for a given actor against the other actor
// Returns { success, attribution, counterStrike, costActual, effectActual, narrative }
export function resolveAction(action, actor, adversary, isPlayer) {
  const result = {
    actionId: action.id,
    actionName: action.name,
    domain: action.domain,
    success: false,
    partial: false,
    attribution: false,
    counterStrike: false,
    costActual: {},
    effectActual: {},
    failurePenalty: {},
    narrativeLines: [],
    self_benefit: {},
  }

  // --- Check power requirements ---
  if (action.min_power) {
    for (const [dim, req] of Object.entries(action.min_power)) {
      if ((actor.power[dim] ?? 0) < req) {
        result.success = false
        result.narrativeLines.push(`Insufficient ${dim} capacity to execute this operation.`)
        return result
      }
    }
  }

  // --- Compute risk profile (drives cost/effect variance ranges) ---
  const riskProfile = computeRiskProfile(action, actor, adversary)
  result.riskLevel = riskProfile.riskLevel

  // --- Determine success probability ---
  // Base success is ~85%; reduced by adversary countermeasures
  const adversaryCounter = getCounterCapability(action, adversary)
  const baseSuccess = 0.85 - adversaryCounter * 0.25
  const roll = Math.random()
  result.success = roll < baseSuccess
  result.partial = !result.success && roll < baseSuccess + 0.15

  // --- Apply self costs (risk-scaled: higher risk = potentially much higher costs) ---
  const [costMin, costMax] = riskProfile.costRange
  for (const [dim, amount] of Object.entries(action.self_cost || {})) {
    const costMult = costMin + Math.random() * (costMax - costMin)
    const actual = Math.round(amount * costMult)
    result.costActual[dim] = actual
  }

  // --- Apply effects to adversary (risk-scaled: higher risk = less reliable effects) ---
  if (result.success || result.partial) {
    const effectMultiplier = result.partial ? 0.5 : 1.0
    const [effectMin, effectMax] = riskProfile.effectRange
    for (const [dim, amount] of Object.entries(action.enemy_effect || {})) {
      // Check condition bonuses
      let bonus = 1.0
      if (action.condition) {
        bonus = checkCondition(action.condition, actor, adversary) ? (action.condition_bonus ?? 1.0) : 1.0
      }
      const effectMult = effectMin + Math.random() * (effectMax - effectMin)
      const actual = Math.round(amount * effectMultiplier * bonus * effectMult)
      result.effectActual[dim] = actual
    }
  }

  // --- Apply failure penalty on full failure ---
  if (!result.success && !result.partial && action.failure_penalty) {
    for (const [dim, amount] of Object.entries(action.failure_penalty)) {
      const variance = 0.8 + Math.random() * 0.4 // 80–120% variance
      const actual = Math.round(amount * variance)
      result.costActual[dim] = (result.costActual[dim] ?? 0) + actual
      result.failurePenalty[dim] = (result.failurePenalty[dim] ?? 0) + actual
    }
  }

  // --- Apply self_benefit for de-escalation ---
  if (action.self_benefit) {
    for (const [dim, amount] of Object.entries(action.self_benefit)) {
      result.self_benefit[dim] = amount
    }
  }

  // --- Attribution check ---
  if (action.attribution_risk > 0) {
    result.attribution = Math.random() < action.attribution_risk
    if (result.attribution) {
      result.costActual.political = (result.costActual.political ?? 0) + (action.backfire_cost?.political ?? 20)
    }
  }

  // --- Counter-strike ---
  if (action.counter_strike_risk > 0 && result.success) {
    result.counterStrike = Math.random() < action.counter_strike_risk
    if (result.counterStrike && action.backfire_cost) {
      for (const [dim, amount] of Object.entries(action.backfire_cost)) {
        result.costActual[dim] = (result.costActual[dim] ?? 0) + amount
      }
    }
  }

  // --- Generate narrative ---
  result.narrativeLines = generateNarrative(action, result, isPlayer)

  return result
}

function getCounterCapability(action, adversary) {
  const cp = (adversary.power.covert ?? 50) / 100
  const ip = (adversary.power.information ?? 50) / 100
  const mp = (adversary.power.military ?? 50) / 100

  if (action.domain === 'information') return ip * 0.4 + cp * 0.1
  if (action.domain === 'military') return mp * 0.3 + cp * 0.1
  return cp * 0.3
}

function checkCondition(condition, actor, adversary) {
  switch (condition) {
    case 'adversary_pp_weak': return adversary.power.political < 45
    case 'adversary_ep_weak': return adversary.power.economic < 45
    case 'adversary_ip_weak': return adversary.power.information < 45
    case 'adversary_mp_weak': return adversary.power.military < 45
    case 'player_ep_strong': return actor.power.economic > 65
    case 'player_ip_advantage': return actor.power.information > adversary.power.information
    case 'adversary_in_conflict':
      return adversary.domain_levels.military >= 5 || adversary.domain_levels.non_military >= 5
    case 'adversary_no_trade_partners':
      return adversary.power.political < 40
    default: return false
  }
}

function generateNarrative(action, result, isPlayer) {
  const actor = isPlayer ? 'Your operatives' : 'Adversary forces'
  const lines = []

  if (!result.success && !result.partial) {
    const failureNarratives = {
      form_coalitions: 'Diplomatic outreach collapsed — partners declined to commit and perceive your overture as weakness.',
      establish_networks: 'Networks were penetrated and rolled up. Assets have been burned.',
      fund_opposition: 'The financing trail was exposed. A political scandal is now unfolding.',
      financial_unrest: 'Market intervention was detected and neutralised. Adversary central bank intervened decisively.',
      economic_sanctions: 'Coalition partners defected. The sanctions regime has fractured before taking effect.',
      deploy_proxies: 'Proxy elements were identified and neutralised. Some have switched allegiances.',
      provocation_event: 'The incident was traced back to your state. The narrative has inverted against you.',
      economic_blockade: 'Blockade was breached. Third-party states are defying the regime openly.',
      seize_territory: 'Assault was repelled with significant losses. The objective remains in adversary hands.',
      embed_journalists: 'Media assets were identified and expelled. Cover is compromised.',
      strategic_comms: 'Campaign was exposed as state-sponsored propaganda. International credibility has suffered.',
      overload_ops: 'Overload attempt was absorbed and rebounded — adversary has isolated your signal vectors.',
      division_narrative: 'Narrative backfired. Adversary population has rallied around the leadership.',
      cyber_proxy: 'Cyber assets were identified and neutralised. Adversary defences have been hardened.',
      disrupt_c2: 'C2 disruption was detected. Redundant systems absorbed the impact and your intrusion has been logged.',
      info_dominance: 'Dominance push collapsed. Adversary has seized the resulting narrative vacuum.',
      mil_pol_isolation: 'Isolation attempt failed. Third parties have rallied to the adversary, viewing your move as overreach.',
      special_forces: 'The team was compromised. A major diplomatic incident is developing.',
      civil_military_uw: 'UW operations were exposed. Adversary has consolidated against the pressure.',
      peacekeeping_cover: 'Mandate questioned by international observers. Legitimacy cover has collapsed.',
      large_exercise: 'Exercise plagued by mishaps and accidents. Adversary has read the performance correctly.',
      strategic_deployment: 'Logistics failure during deployment has exposed critical vulnerabilities.',
      military_actions: 'Operations met fierce resistance. Forces have suffered significant attrition.',
    }
    const failureLine = failureNarratives[action.id] ?? 'Operation failed to achieve intended objectives. Resistance was stronger than anticipated.'
    lines.push(failureLine)
    if (Object.keys(result.failurePenalty).length > 0) {
      lines.push('FAILURE BLOWBACK: The botched operation has created additional strategic setbacks beyond the operation cost.')
    }
    return lines
  }

  const quality = result.partial ? 'partially' : 'successfully'
  lines.push(`${action.name}: ${quality.charAt(0).toUpperCase() + quality.slice(1)} executed.`)

  // Domain-specific flavor
  const flavors = {
    'form_coalitions': result.success
      ? 'Diplomatic channels secured new commitments from regional partners.'
      : 'Preliminary coalition outreach showed limited uptake.',
    'establish_networks': 'Minority network seeding underway — long-term asset in development.',
    'fund_opposition': result.success
      ? 'Opposition groups received significant financial injection. Domestic pressure building.'
      : 'Funding reached opposition leadership but organisational capacity remains limited.',
    'financial_unrest': result.success
      ? 'Markets responded sharply to coordinated pressure. Adversary capital flight detected.'
      : 'Market disruption was contained; adversary central bank intervened.',
    'economic_sanctions': 'Sanctions regime activated. Economic isolation will compound over time.',
    'deploy_proxies': 'Proxy elements are active in the field. Attribution remains deniable.',
    'provocation_event': 'The incident achieved its intended effect — adversary response has been politically costly.',
    'economic_blockade': 'Blockade is fully operational. Adversary supply lines are under significant strain.',
    'seize_territory': result.success
      ? 'Proxy forces have secured the objective. Vital ground is now under effective control.'
      : 'Territorial seizure was contested. Control remains disputed.',
    'embed_journalists': 'Media assets are embedded and beginning to contest the adversary narrative.',
    'strategic_comms': 'Information campaign is live across key channels. Adversary standing is under pressure.',
    'overload_ops': 'Information overload operation is straining adversary decision-making cycles.',
    'division_narrative': 'Division narratives are gaining traction within adversary domestic audience.',
    'cyber_proxy': result.success
      ? 'Cyber assets disrupted adversary information infrastructure. Deniability maintained.'
      : 'Cyber operation was partially contained by adversary defences.',
    'disrupt_c2': result.success
      ? 'Command and control disruption confirmed. Adversary military coordination is degraded.'
      : 'C2 disruption was partially effective — redundant systems absorbed some impact.',
    'info_dominance': 'Information dominance established. Adversary narrative space is contracting.',
    'mil_pol_isolation': 'Adversary isolation from international community is advancing rapidly.',
    'special_forces': result.success
      ? 'Special forces operation executed without attribution. Adversary destabilisation progressing.'
      : 'Special forces encountered unexpected resistance. Objectives partially achieved.',
    'civil_military_uw': 'Unconventional warfare operations are eroding adversary capacity across multiple dimensions.',
    'peacekeeping_cover': 'Operations proceeding under peacekeeping mandate. International legitimacy maintained.',
    'large_exercise': 'Major exercise has demonstrated readiness. Adversary has been forced into defensive posture.',
    'strategic_deployment': 'Forward deployment is complete. Signal received by adversary — counter-deployment underway.',
    'military_actions': result.success
      ? 'Military operations proceeding. Adversary forces taking significant attrition.'
      : 'Military engagement produced mixed results. Both sides taking losses.',
    'backchannel_diplomacy': 'Diplomatic contact established. Signals indicate adversary may be receptive.',
    'economic_normalisation': 'Economic normalisation proposal transmitted. International community noting your restraint.',
    'conflict_settlement': 'Settlement framework proposed. A resolution pathway now exists.',
    'reduce_narrative': 'Information posture reduced. De-escalation signals have been noted internationally.',
    'allow_media_access': 'Adversary media access granted — a confidence-building measure that has improved standing.',
    'stand_down_exercises': 'Exercise stand-down announced. Reduces military tension in the theatre.',
    'strategic_redeployment': 'Forces have been pulled back from forward positions. Tension is measurably reduced.',
    'new_peacekeeping': 'Peacekeeping framework proposed. If accepted, this could freeze the conflict.',
  }

  if (flavors[action.id]) {
    lines.push(flavors[action.id])
  }

  if (result.attribution) {
    lines.push('ATTRIBUTION EVENT: Operation has been linked to your state by adversary intelligence. Political cost incurred.')
  }

  if (result.counterStrike) {
    lines.push('COUNTER-STRIKE: Adversary launched a retaliatory operation. Additional costs absorbed.')
  }

  return lines
}

// Apply all ongoing active operations for a state (per-turn tick)
export function tickActiveOperations(state, adversaryState) {
  const costsDelta = {}
  const effectsDelta = {}

  for (const op of state.active_operations) {
    // Self costs
    if (op.ongoing_self_cost) {
      for (const [dim, amount] of Object.entries(op.ongoing_self_cost)) {
        costsDelta[dim] = (costsDelta[dim] ?? 0) + amount
      }
    }
    // Enemy effects
    if (op.ongoing_enemy_effect) {
      for (const [dim, amount] of Object.entries(op.ongoing_enemy_effect)) {
        effectsDelta[dim] = (effectsDelta[dim] ?? 0) + amount
      }
    }
  }

  return { selfCosts: costsDelta, enemyEffects: effectsDelta }
}

// Forced costs adversary pays just from your active operations
export function computeForcedCosts(activeOps) {
  const costs = {}
  for (const op of activeOps) {
    if (op.forced_enemy_cost) {
      for (const [dim, amount] of Object.entries(op.forced_enemy_cost)) {
        costs[dim] = (costs[dim] ?? 0) + amount
      }
    }
  }
  return costs
}
