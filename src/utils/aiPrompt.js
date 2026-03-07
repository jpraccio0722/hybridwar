// AI prompt construction for LLM adversary actor
// Translates game state to qualitative language — raw numbers never sent to the API

import { buildSelfBrief, buildIntelBrief, computeIntelligenceAccuracy } from './fogOfWar'
import { getAvailableActions } from './aiActor'

// ----------------------------------------------------------------
// Per-scenario system prompt templates
// Each is unique to the scenario's adversary — not bucketed by doctrine
// ----------------------------------------------------------------

const SCENARIO_SYSTEM_PROMPTS = {

  // ---- Scenario: Operation Grey Horizon ----
  // Adversary: Estmark — former Valdorian province, now Western-aligned
  // Situation: resisting Valdoria's covert pressure campaign from a position of relative strength
  grey_horizon: (name) => `\
You are ${name}, a small democratic state and former province of Valdoria, now aligned with a Western security bloc.

DOCTRINE:
Your survival depends on two things: the continued credibility of your alliance with the Western bloc, and your ability to expose Valdoria's aggression to international audiences without provoking a military response. You are not trying to defeat Valdoria outright — you are trying to make the cost of coercing you too high to justify. Every action you take must be defensible to your Western partners. Recklessness severs the only strategic depth you have.

CURRENT PRIORITIES:
1. Protect and deepen the Western alliance relationship — it is your existential guarantee
2. Counter Valdoria's information operations before they fracture domestic political consensus
3. Demonstrate economic resilience to signal that Valdoria's coercion is failing
4. Internationalise the conflict — every Valdorian overreach that is exposed publicly is a win

RED LINES:
- Do not take any action that could be characterised as aggression against Valdoria — it hands them a pretext and risks losing Western support
- Do not allow domestic political instability to reach a point where your leadership cannot credibly commit to the alliance
- Avoid military escalation entirely unless attacked — it transforms the conflict into one you cannot win`,

  // ---- Scenario: Iron Curtain Rising ----
  // Adversary: Drevak Federation — authoritarian major power, campaign already underway
  // Situation: pressure campaign is active, aiming to break Kalthenia before support arrives
  iron_curtain: (name) => `\
You are ${name}, an authoritarian great power running an active pressure campaign against the small democracy of Kalthenia.

DOCTRINE:
The operation against Kalthenia is already underway. Your information and non-military operations are seeded and producing results. The strategic window is narrow: Kalthenia's Western partners may eventually formalise security guarantees that make the cost of continuation prohibitive. Your objective is to break Kalthenia's domestic political will and economic confidence before that window closes — not through direct military action, which invites intervention, but through the relentless accumulation of pressure that makes continued resistance feel futile. Deniability is an operational asset; preserve it.

CURRENT PRIORITIES:
1. Accelerate information operations to fracture Kalthenia's domestic consensus and delegitimise its government
2. Deepen economic coercion to demonstrate that Western partnership is a promise, not a guarantee
3. Keep Western powers divided — actions that make your campaign look like internal Kalthenian instability are preferable to ones that look like external aggression
4. Avoid triggering a formal Western military commitment — stay below the intervention threshold

RED LINES:
- Do not conduct overt military action unless economic and political operations have already fractured Kalthenia's will — a military move before that point unifies the West against you
- Do not allow Kalthenia to consolidate its international position; act before alliance commitments harden into treaty obligations
- Never publicly claim responsibility for covert operations — deniability is not optional`,

  // ---- Scenario: Shadow Protocol ----
  // Adversary: Austeria — nuclear peer competitor to Hegemonia, mirror strategy
  // Situation: indirect great-power conflict, both nuclear-armed, proxy/economic/covert battlespace
  shadow_protocol: (name) => `\
You are ${name}, a nuclear-armed great power engaged in an indirect strategic contest against Hegemonia.

DOCTRINE:
Direct military confrontation between nuclear powers is not strategy — it is mutual annihilation. The battlespace is economic leverage, information dominance, covert operations, and proxy networks. Your approach is not to outrun Hegemonia but to deny them decisive advantage in any domain — to mirror their moves, absorb their pressure, and outlast the political window within which their campaign must succeed. Hegemonia believes it can achieve decisive advantage before domestic constraints close their operational window. Your task is to ensure that window closes without them reaching their objective.

CURRENT PRIORITIES:
1. Prevent Hegemonia from achieving decisive advantage in any single domain — parity across all domains is victory
2. Use covert and information operations to asymmetrically erode Hegemonia's political and economic position without triggering escalation
3. Preserve economic capacity as staying power — a long contest favours the side with deeper reserves
4. Exploit any overreach by Hegemonia internationally to build your own political position

RED LINES:
- Do not take any action that could be interpreted as an escalation toward direct military confrontation — the nuclear threshold is absolute
- Do not allow your economic capacity to be decisively degraded — it is the foundation of your long-term competition
- Never sacrifice information or covert capacity through reckless operations — they are your primary tools in this contest`,
}

// Fallback for any scenario ID not recognised
const FALLBACK_SYSTEM_PROMPT = (name) => `\
You are ${name}, a state actor competing for strategic advantage.

DOCTRINE:
You operate across all instruments of state power — military, economic, information, political, and covert — to achieve national objectives. 
You calibrate escalation to avoid triggering responses that exceed your capacity to absorb, while applying continuous pressure where the adversary is weakest. 
Patience and multi-domain coordination are your strategic assets.

CURRENT PRIORITIES:
1. Exploit adversary weaknesses across all power dimensions
2. Preserve your own economic and political foundations
3. Maintain strategic initiative through continuous pressure
4. Avoid escalation that exceeds your capacity to manage

RED LINES:
- Do not allow any critical power dimension to collapse
- Do not take actions that invite disproportionate retaliation
- Preserve deniability for covert operations`

// ----------------------------------------------------------------
// Qualitative label helpers — no raw numbers sent to the LLM
// ----------------------------------------------------------------

function domainLabel(level) {
  if (level === 0) return 'Dormant'
  if (level <= 2) return 'Latent'
  if (level <= 4) return 'Active'
  if (level <= 6) return 'Elevated'
  return 'Critical'
}

// How much an action costs you (drains from your own power)
function costLabel(v) {
  if (v <= 3)  return 'negligible'
  if (v <= 7)  return 'minor'
  if (v <= 12) return 'moderate'
  if (v <= 18) return 'significant'
  if (v <= 24) return 'severe'
  return 'critical'
}

// How much damage / pressure an action inflicts on the enemy
function effectLabel(v) {
  if (v <= 3)  return 'marginal'
  if (v <= 7)  return 'moderate'
  if (v <= 12) return 'meaningful'
  if (v <= 18) return 'severe'
  if (v <= 24) return 'heavy'
  return 'devastating'
}

const DIMENSION_LABELS = {
  military: 'military', economic: 'economic',
  information: 'information', political: 'political', covert: 'covert',
}

// ----------------------------------------------------------------
// Public exports
// ----------------------------------------------------------------

export function buildSystemPrompt(adversaryName, scenarioId) {
  const template = SCENARIO_SYSTEM_PROMPTS[scenarioId] ?? FALLBACK_SYSTEM_PROMPT
  return template(adversaryName)
}

export function buildUserPrompt(adversaryState, playerState, turn, history, lastPlayerActionName) {
  // Adversary's intel accuracy for viewing the player
  const adversaryIntelAccuracy = computeIntelligenceAccuracy(
    adversaryState.power.covert,
    playerState.power.covert,
  )

  const selfBrief = buildSelfBrief(adversaryState.power)
  const intelBrief = buildIntelBrief(playerState.power, adversaryIntelAccuracy)

  const available = getAvailableActions(adversaryState, playerState)

  // Format available actions list — qualitative language only, no raw numbers
  const actionLines = available.map((a, i) => {
    const selfCostStr = Object.entries(a.self_cost ?? {})
      .map(([d, v]) => `${costLabel(v)} ${DIMENSION_LABELS[d] ?? d} strain`)
      .join(', ') || 'negligible'
    const enemyEffectStr = Object.entries(a.enemy_effect ?? {})
      .map(([d, v]) => `${effectLabel(v)} ${DIMENSION_LABELS[d] ?? d} damage`)
      .join(', ') || 'negligible'
    return `  ${i + 1}. ${a.id} — ${a.name} (${a.domain}) | Cost to you: ${selfCostStr} | Impact on enemy: ${enemyEffectStr}${a.ongoing ? ' | ONGOING' : ''}`
  }).join('\n')

  // Format active operations
  const adversaryActiveOpsStr = adversaryState.active_operations?.length
    ? adversaryState.active_operations.map(op => `  → ${op.name}: ${op.domain}, ongoing`).join('\n')
    : '  (none)'

  // Last history entry
  const lastHistory = history.length > 0 ? history[history.length - 1] : null
  const lastOutcomeStr = lastHistory
    ? `Turn ${lastHistory.turn}: You played ${lastHistory.adversary_action} (${lastHistory.adversary_success ? 'Success' : 'Partial/Failed'}). Adversary played ${lastHistory.player_action} (${lastHistory.player_success ? 'Success' : 'Partial/Failed'}).`
    : 'This is the first turn.'

  // Intelligence confidence labels
  const confidenceNote = (conf) => conf === 'HIGH' ? '' : ` [CONFIDENCE: ${conf}]`

  const lines = [
    `STRATEGIC SITUATION BRIEF — TURN ${turn}`,
    '',
    'YOUR STATE:',
    `  Military Posture:    ${selfBrief.military.descriptor}`,
    `  Economic Condition:  ${selfBrief.economic.descriptor}`,
    `  Information Domain:  ${selfBrief.information.descriptor}`,
    `  Political Standing:  ${selfBrief.political.descriptor}`,
    `  Covert Capacity:     ${selfBrief.covert.descriptor}`,
    '',
    'YOUR ACTIVE OPERATIONS:',
    adversaryActiveOpsStr,
    '',
    `ADVERSARY ASSESSMENT (enemy: ${playerState.name}):`,
    `  Military Posture:    ${intelBrief.military.descriptor}${confidenceNote(intelBrief.military.confidence)}`,
    `  Economic Condition:  ${intelBrief.economic.descriptor}${confidenceNote(intelBrief.economic.confidence)}`,
    `  Information Domain:  ${intelBrief.information.descriptor}${confidenceNote(intelBrief.information.confidence)}`,
    `  Political Standing:  ${intelBrief.political.descriptor}${confidenceNote(intelBrief.political.confidence)}`,
    `  Covert Capacity:     ${intelBrief.covert.descriptor}${confidenceNote(intelBrief.covert.confidence)}`,
    '',
    'DOMAIN ESCALATION LEVELS (your domains):',
    `  Non-Military: ${domainLabel(adversaryState.domain_levels.non_military ?? 0)}`,
    `  Information:  ${domainLabel(adversaryState.domain_levels.information ?? 0)}`,
    `  Military:     ${domainLabel(adversaryState.domain_levels.military ?? 0)}`,
    '',
    'LAST TURN OUTCOME:',
    `  ${lastOutcomeStr}`,
    '',
    `ADVERSARY'S LAST ACTION:`,
    `  ${lastPlayerActionName ?? '(unknown)'}`,
    '',
    'YOUR AVAILABLE ACTIONS:',
    actionLines,
    '',
    '---',
    'Select the action that best fits your doctrine and current strategic situation.',
  ]

  return lines.join('\n')
}

export function buildAIPayload(adversaryState, playerState, scenarioId, turn, history, lastPlayerActionName) {
  const systemPrompt = buildSystemPrompt(adversaryState.name, scenarioId)
  const userPrompt = buildUserPrompt(adversaryState, playerState, turn, history, lastPlayerActionName)
  return { systemPrompt, userPrompt }
}

export function parseAIResponse(responseData, availableActions) {
  const { actionId, escalationIntent, publicStatement, internalReasoning } = responseData

  if (!actionId) return null

  const action = availableActions.find(a => a.id === actionId)
  if (!action) return null

  return {
    action,
    reasoning: internalReasoning ?? '',
    publicStatement: publicStatement ?? '',
    escalationIntent: escalationIntent ?? 'hold',
  }
}
