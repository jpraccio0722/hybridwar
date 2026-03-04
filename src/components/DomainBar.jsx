import { CONFLICT_PHASES, getConflictPhase } from '../utils/fogOfWar'
import { getAdvantageLabel } from '../utils/gameEngine'

const DOMAIN_CONFIG = {
  non_military: { label: 'Non-Military', abbrev: 'NM', colorClass: 'domain--non-military' },
  information: { label: 'Information', abbrev: 'IW', colorClass: 'domain--information' },
  military: { label: 'Military', abbrev: 'MIL', colorClass: 'domain--military' },
}

function getLevelLabel(level) {
  if (level === 0) return 'Dormant'
  if (level <= 2) return 'Latent'
  if (level <= 4) return 'Active'
  if (level <= 6) return 'Elevated'
  if (level <= 8) return 'Critical'
  return 'Maximum'
}

function getLevelClass(level) {
  if (level === 0) return 'level--dormant'
  if (level <= 2) return 'level--latent'
  if (level <= 4) return 'level--active'
  if (level <= 6) return 'level--elevated'
  if (level <= 8) return 'level--critical'
  return 'level--maximum'
}

function getAdvantageValueClass(adv) {
  if (adv > 3) return 'adv-value--positive'
  if (adv < -3) return 'adv-value--negative'
  return 'adv-value--neutral'
}

const POWER_ABBREV = {
  military: 'MP',
  economic: 'EP',
  information: 'IP',
  political: 'PP',
  covert: 'CP',
}

function getPowerClass(score) {
  if (score >= 60) return 'pstat--high'
  if (score >= 35) return 'pstat--medium'
  if (score >= 15) return 'pstat--low'
  return 'pstat--critical'
}

export default function DomainBar({ playerDomains, adversaryDomains, turn, strategicAdvantage, playerPower }) {
  const phase = getConflictPhase(playerDomains)

  // Bar layout: center = 50%. Player (blue) fills from left; adversary (red) from right.
  // Clamp to 0–100 to prevent overflow.
  const adv = strategicAdvantage ?? 0
  const playerWidth = Math.max(0, Math.min(100, 50 + adv / 2))
  const adversaryWidth = Math.max(0, Math.min(100, 50 - adv / 2))
  const advLabel = getAdvantageLabel(adv)
  const advDisplay = adv > 0 ? `+${adv}` : `${adv}`

  return (
    <div className="domain-bar">
      <div className="domain-bar__header">
        <div className="domain-bar__turn">
          <span className="turn-label">Turn</span>
          <span className="turn-number">{turn}</span>
        </div>
        <div className="domain-bar__phase">
          <span className="phase-label">Scenario: </span>
          <span className="phase-name">{CONFLICT_PHASES[phase]}</span>
        </div>
      </div>

      {/* Compact power strip */}
      {playerPower && (
        <div className="power-strip">
          {Object.entries(playerPower).map(([dim, score]) => (
            <div key={dim} className="pstat">
              <span className="pstat__abbrev">{POWER_ABBREV[dim]}</span>
              <span className={`pstat__score ${getPowerClass(score)}`}>{score}</span>
            </div>
          ))}
        </div>
      )}

      {/* Strategic Advantage meter */}
      <div className="advantage-strip">
        <div className="advantage-strip__meta">
          <span className="advantage-strip__heading">Strategic Advantage</span>
          <div className="advantage-strip__right">
            <span className="advantage-strip__label">{advLabel}</span>
            <span className={`advantage-strip__value ${getAdvantageValueClass(adv)}`}>{advDisplay}</span>
          </div>
        </div>
        <div className="advantage-bar-track" role="meter" aria-label={`Strategic advantage: ${advDisplay}`} aria-valuenow={adv} aria-valuemin={-100} aria-valuemax={100}>
          <div className="advantage-bar__player" style={{ width: `${playerWidth}%` }} />
          <div className="advantage-bar__adversary" style={{ width: `${adversaryWidth}%` }} />
        </div>
        <div className="advantage-bar__axis">
          <span>You</span>
          <span>Adversary</span>
        </div>
      </div>
    </div>
  )
}
