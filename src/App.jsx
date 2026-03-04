import { useReducer, useEffect } from 'react'
import Setup from './components/Setup'
import Board from './components/Board'
import AIThinking from './components/AIThinking'
import Resolution from './components/Resolution'
import GameOver from './components/GameOver'
import {
  applyRegeneration,
  applyPowerDelta,
  applyPowerGain,
  updateDomainLevel,
  checkThresholdCascades,
  checkWinConditions,
  addActiveOperation,
  cancelOperation,
  computeStrategicAdvantage,
} from './utils/gameEngine'
import { resolveAction, tickActiveOperations, computeForcedCosts } from './utils/resolver'
import { aiSelectAction, getAvailableActions, generateDoctrineWeights } from './utils/aiActor'
import { computeIntelligenceAccuracy } from './utils/fogOfWar'
import { buildAIPayload, parseAIResponse } from './utils/aiPrompt'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-move`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const DEBUG_AI = import.meta.env.VITE_DEBUG_AI === 'true'

async function callEdgeFunction(systemPrompt, userPrompt) {
  if (DEBUG_AI) {
    console.group('[AI DEBUG] Outgoing prompt')
    console.log('%cSYSTEM PROMPT\n', 'font-weight:bold', systemPrompt)
    console.log('%cUSER PROMPT\n', 'font-weight:bold', userPrompt)
    console.groupEnd()
  }
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ systemPrompt, userPrompt }),
  })
  if (!res.ok) throw new Error(`Edge function error: ${res.status}`)
  const data = await res.json()
  if (DEBUG_AI) {
    console.group('[AI DEBUG] Raw LLM response')
    console.log(data)
    console.groupEnd()
  }
  return data
}

const initialAppState = {
  screen: 'setup', // setup | game | ai_thinking | resolution | game_over
  turn: 1,
  gameState: null,
  pendingAIState: null,
  lastResolution: null,
  gameOverResult: null,
}

// Shared resolution helper — used by both AI_MOVE_RESOLVED and AI_MOVE_FAILED
function resolveTurnWithAIAction(state, aiAction, aiReasoning, aiPublicStatement, aiEscalationIntent) {
  const gs = state.gameState
  const pending = state.pendingAIState

  const {
    playerPower: rawPlayerPower,
    adversaryPower: rawAdversaryPower,
    playerDomains,
    playerActiveOps,
    adversaryDomains,
    adversaryActiveOps,
    playerResult,
    playerTick,
    advantageBefore,
  } = pending

  let playerPower = { ...rawPlayerPower }
  let adversaryPower = { ...rawAdversaryPower }
  let finalAdversaryDomains = { ...adversaryDomains }
  let finalAdversaryActiveOps = [...adversaryActiveOps]

  // Resolve adversary action
  let adversaryResult = null
  if (aiAction) {
    const updatedAdversary = {
      ...gs.adversary,
      power: adversaryPower,
      domain_levels: adversaryDomains,
      active_operations: adversaryActiveOps,
    }
    const updatedPlayer = {
      ...gs.player,
      power: playerPower,
      domain_levels: playerDomains,
      active_operations: playerActiveOps,
    }
    adversaryResult = resolveAction(aiAction, updatedAdversary, updatedPlayer, false)
    adversaryPower = applyPowerDelta(adversaryPower, adversaryResult.costActual)
    playerPower = applyPowerDelta(playerPower, adversaryResult.effectActual)
    if (adversaryResult.self_benefit) {
      adversaryPower = applyPowerGain(adversaryPower, adversaryResult.self_benefit)
    }
    finalAdversaryDomains = updateDomainLevel(finalAdversaryDomains, aiAction.domain, aiAction.escalates_to)
    finalAdversaryActiveOps = addActiveOperation(finalAdversaryActiveOps, aiAction)
  }

  // Advantage delta
  const advantageAfter = computeStrategicAdvantage(playerPower, adversaryPower)
  const advantageDelta = advantageAfter - advantageBefore

  // Build final states
  const newPlayerState = {
    ...gs.player,
    power: playerPower,
    domain_levels: playerDomains,
    active_operations: playerActiveOps,
  }
  const newAdversaryState = {
    ...gs.adversary,
    power: adversaryPower,
    domain_levels: finalAdversaryDomains,
    active_operations: finalAdversaryActiveOps,
  }

  const cascadeEvents = checkThresholdCascades(newPlayerState, newAdversaryState)

  const newIntelAccuracy = computeIntelligenceAccuracy(
    playerPower.covert,
    adversaryPower.covert,
  )

  const historyEntry = {
    turn: state.turn,
    player_action: playerResult.actionName,
    player_success: playerResult.success,
    player_partial: playerResult.partial ?? false,
    player_cost: playerResult.costActual ?? {},
    player_effect: playerResult.effectActual ?? {},
    player_attribution: playerResult.attribution ?? false,
    player_counter_strike: playerResult.counterStrike ?? false,
    player_narrative: playerResult.narrativeLines?.[0] ?? null,
    adversary_action: aiAction?.name ?? 'No action taken',
    adversary_success: adversaryResult?.success ?? false,
    adversary_partial: adversaryResult?.partial ?? false,
    adversary_effect: adversaryResult?.effectActual ?? {},
    cascade_events: cascadeEvents,
    advantage_after: advantageAfter,
    advantage_delta: advantageDelta,
  }

  const newHistory = [...gs.history, historyEntry]
  const winCheck = checkWinConditions(newPlayerState, newAdversaryState, state.turn, gs.win_conditions)

  const resolution = {
    playerResult,
    adversaryResult,
    aiReasoning,
    aiAction,
    aiPublicStatement,
    aiEscalationIntent,
    cascadeEvents,
    tickSummary: {
      playerOngoingCosts: playerTick.selfCosts,
      adversaryOngoingEffects: playerTick.enemyEffects,
    },
    advantageBefore,
    advantageAfter,
    advantageDelta,
  }

  const newGameState = {
    ...gs,
    player: newPlayerState,
    adversary: newAdversaryState,
    intelligence_accuracy: newIntelAccuracy,
    strategicAdvantage: advantageAfter,
    win_conditions: gs.win_conditions,
    history: newHistory,
  }

  if (winCheck.over) {
    return {
      ...state,
      screen: 'game_over',
      turn: state.turn,
      gameState: newGameState,
      pendingAIState: null,
      lastResolution: resolution,
      gameOverResult: winCheck,
    }
  }

  return {
    ...state,
    screen: 'resolution',
    turn: state.turn,
    gameState: newGameState,
    pendingAIState: null,
    lastResolution: resolution,
  }
}

function gameReducer(state, action) {
  switch (action.type) {

    case 'START_GAME': {
      const scenario = action.payload
      const intelligenceAccuracy = computeIntelligenceAccuracy(
        scenario.player.power.covert,
        scenario.adversary.power.covert,
      )
      const initialAdvantage = computeStrategicAdvantage(
        scenario.player.power,
        scenario.adversary.power,
      )

      return {
        ...state,
        screen: 'game',
        turn: 1,
        gameState: {
          scenario_id: scenario.id,
          scenario_name: scenario.name,
          player: {
            name: scenario.player.name,
            power: { ...scenario.player.power },
            domain_levels: { ...scenario.player.domain_levels },
            active_operations: [],
          },
          adversary: {
            name: scenario.adversary.name,
            doctrine: scenario.adversary.doctrine,
            doctrine_label: scenario.adversary.doctrine_label,
            doctrine_weights: generateDoctrineWeights(scenario.adversary.doctrine),
            power: { ...scenario.adversary.power },
            domain_levels: { ...scenario.adversary.domain_levels },
            active_operations: [],
          },
          intelligence_accuracy: intelligenceAccuracy,
          strategicAdvantage: initialAdvantage,
          win_conditions: scenario.win_conditions ?? null,
          history: [],
        },
        pendingAIState: null,
        lastResolution: null,
        gameOverResult: null,
      }
    }

    case 'PLAYER_ACTION': {
      const { action: chosenAction } = action.payload
      const gs = state.gameState

      // 1. Start-of-turn: regen + ongoing ops + forced costs
      let playerPower = applyRegeneration(gs.player.power, gs.player.active_operations, gs.player.domain_levels)
      let adversaryPower = applyRegeneration(gs.adversary.power, gs.adversary.active_operations, gs.adversary.domain_levels)

      const playerTick = tickActiveOperations(gs.player, gs.adversary)
      const adversaryTick = tickActiveOperations(gs.adversary, gs.player)

      playerPower = applyPowerDelta(playerPower, playerTick.selfCosts)
      adversaryPower = applyPowerDelta(adversaryPower, playerTick.enemyEffects)
      adversaryPower = applyPowerDelta(adversaryPower, adversaryTick.selfCosts)
      playerPower = applyPowerDelta(playerPower, adversaryTick.enemyEffects)

      const playerForcedCosts = computeForcedCosts(gs.player.active_operations)
      const adversaryForcedCosts = computeForcedCosts(gs.adversary.active_operations)
      adversaryPower = applyPowerDelta(adversaryPower, playerForcedCosts)
      playerPower = applyPowerDelta(playerPower, adversaryForcedCosts)

      // 2. Resolve player action
      const tempPlayerState = { ...gs.player, power: playerPower }
      const tempAdversaryState = { ...gs.adversary, power: adversaryPower }

      const playerResult = resolveAction(chosenAction, tempPlayerState, tempAdversaryState, true)

      playerPower = applyPowerDelta(playerPower, playerResult.costActual)
      adversaryPower = applyPowerDelta(adversaryPower, playerResult.effectActual)
      if (playerResult.self_benefit) {
        playerPower = applyPowerGain(playerPower, playerResult.self_benefit)
      }

      const playerDomains = updateDomainLevel(gs.player.domain_levels, chosenAction.domain, chosenAction.escalates_to)
      const playerActiveOps = addActiveOperation(gs.player.active_operations, chosenAction)

      const advantageBefore = gs.strategicAdvantage ?? computeStrategicAdvantage(gs.player.power, gs.adversary.power)

      // 3. Park state and wait for async AI
      return {
        ...state,
        screen: 'ai_thinking',
        pendingAIState: {
          playerPower,
          adversaryPower,
          playerDomains,
          playerActiveOps,
          adversaryDomains: gs.adversary.domain_levels,
          adversaryActiveOps: gs.adversary.active_operations,
          playerResult,
          playerTick,
          advantageBefore,
        },
      }
    }

    case 'AI_MOVE_RESOLVED': {
      const { aiAction, aiReasoning, aiPublicStatement, aiEscalationIntent } = action.payload
      return resolveTurnWithAIAction(state, aiAction, aiReasoning, aiPublicStatement, aiEscalationIntent)
    }

    case 'AI_MOVE_FAILED': {
      // Rule-based fallback — compute synchronously, then resolve
      const gs = state.gameState
      const pending = state.pendingAIState
      if (!pending) return state

      const updatedAdversary = {
        ...gs.adversary,
        power: pending.adversaryPower,
        domain_levels: pending.adversaryDomains,
        active_operations: pending.adversaryActiveOps,
      }
      const updatedPlayer = {
        ...gs.player,
        power: pending.playerPower,
        domain_levels: pending.playerDomains,
        active_operations: pending.playerActiveOps,
      }
      const { action: aiAction, reasoning: aiReasoning } = aiSelectAction(
        updatedAdversary,
        updatedPlayer,
        gs.intelligence_accuracy,
      )
      return resolveTurnWithAIAction(state, aiAction, aiReasoning, '', 'hold')
    }

    case 'NEXT_TURN': {
      return {
        ...state,
        screen: 'game',
        turn: state.turn + 1,
        lastResolution: null,
      }
    }

    case 'CANCEL_OPERATION': {
      const { operationId, side } = action.payload
      const gs = state.gameState
      if (side === 'player') {
        return {
          ...state,
          gameState: {
            ...gs,
            player: {
              ...gs.player,
              active_operations: cancelOperation(gs.player.active_operations, operationId),
            },
          },
        }
      }
      return state
    }

    case 'RESTART': {
      return initialAppState
    }

    default:
      return state
  }
}

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialAppState)

  // Async AI move — runs whenever we enter ai_thinking screen
  useEffect(() => {
    if (state.screen !== 'ai_thinking' || !state.pendingAIState || !state.gameState) return

    const gs = state.gameState
    const pending = state.pendingAIState

    const updatedAdversary = {
      ...gs.adversary,
      power: pending.adversaryPower,
      domain_levels: pending.adversaryDomains,
      active_operations: pending.adversaryActiveOps,
    }
    const updatedPlayer = {
      ...gs.player,
      power: pending.playerPower,
      domain_levels: pending.playerDomains,
      active_operations: pending.playerActiveOps,
    }

    const availableActions = getAvailableActions(updatedAdversary, updatedPlayer)
    const { systemPrompt, userPrompt } = buildAIPayload(
      updatedAdversary,
      updatedPlayer,
      gs.scenario_id,
      state.turn,
      gs.history,
      pending.playerResult?.actionName ?? '',
    )

    async function runAIMove() {
      try {
        const responseData = await callEdgeFunction(systemPrompt, userPrompt)
        const parsed = parseAIResponse(responseData, availableActions)
        if (parsed) {
          dispatch({
            type: 'AI_MOVE_RESOLVED',
            payload: {
              aiAction: parsed.action,
              aiReasoning: parsed.reasoning,
              aiPublicStatement: parsed.publicStatement,
              aiEscalationIntent: parsed.escalationIntent,
            },
          })
        } else {
          console.warn('LLM returned invalid action_id, falling back to rule-based AI')
          dispatch({ type: 'AI_MOVE_FAILED' })
        }
      } catch (err) {
        console.warn('LLM AI failed, falling back to rule-based AI:', err)
        dispatch({ type: 'AI_MOVE_FAILED' })
      }
    }

    runAIMove()
  }, [state.screen, state.pendingAIState]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartGame = (scenario) => {
    dispatch({ type: 'START_GAME', payload: scenario })
  }

  const handlePlayerAction = (action) => {
    dispatch({ type: 'PLAYER_ACTION', payload: { action } })
  }

  const handleNextTurn = () => {
    dispatch({ type: 'NEXT_TURN' })
  }

  const handleCancelOperation = (operationId) => {
    dispatch({ type: 'CANCEL_OPERATION', payload: { operationId, side: 'player' } })
  }

  const handleRestart = () => {
    dispatch({ type: 'RESTART' })
  }

  return (
    <div className="app-root">
      {state.screen === 'setup' && (
        <Setup onStartGame={handleStartGame} />
      )}
      {state.screen === 'game' && state.gameState && (
        <Board
          gameState={state.gameState}
          turn={state.turn}
          onPlayerAction={handlePlayerAction}
          onCancelOperation={handleCancelOperation}
        />
      )}
      {state.screen === 'ai_thinking' && state.gameState && (
        <AIThinking
          adversaryName={state.gameState.adversary.name}
          doctrineLabel={state.gameState.adversary.doctrine_label}
        />
      )}
      {state.screen === 'resolution' && state.gameState && (
        <Resolution
          gameState={state.gameState}
          resolution={state.lastResolution}
          turn={state.turn}
          onNextTurn={handleNextTurn}
        />
      )}
      {state.screen === 'game_over' && state.gameState && (
        <GameOver
          gameState={state.gameState}
          resolution={state.lastResolution}
          result={state.gameOverResult}
          turn={state.turn}
          onRestart={handleRestart}
        />
      )}
    </div>
  )
}
