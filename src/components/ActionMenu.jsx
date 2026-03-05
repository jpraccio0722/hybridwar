import { getAvailableActionsForState } from '../utils/gameEngine'
import { computeRiskProfile } from '../utils/resolver'
import { useState } from 'react'

const DOMAIN_CONFIG = {
  non_military: { label: 'Non-Military', class: 'domain-tab--non-military' },
  information: { label: 'Information', class: 'domain-tab--information' },
  military: { label: 'Military', class: 'domain-tab--military' },
}

const REVERSIBILITY_LABELS = {
  easy: 'Easily reversed',
  moderate: 'Mod reversible',
  hard: 'Hard to reverse',
  very_hard: 'Very hard to reverse',
}

const REVERSIBILITY_CLASS = {
  easy: 'rev--easy',
  moderate: 'rev--moderate',
  hard: 'rev--hard',
  very_hard: 'rev--very-hard',
}

const RISK_CONFIG = {
  low:      { label: 'Low Risk',     class: 'badge--risk-low' },
  moderate: { label: 'Mod Risk',     class: 'badge--risk-moderate' },
  high:     { label: 'High Risk',    class: 'badge--risk-high' },
  extreme:  { label: 'Extreme Risk', class: 'badge--risk-extreme' },
}

export default function ActionMenu({ playerState, adversaryState, onSelectAction }) {
  const [activeDomain, setActiveDomain] = useState('non_military')

  const allAvailable = getAvailableActionsForState(playerState)
  const byDomain = {
    non_military: allAvailable.filter(a => a.domain === 'non_military'),
    information: allAvailable.filter(a => a.domain === 'information'),
    military: allAvailable.filter(a => a.domain === 'military'),
  }

  const displayed = byDomain[activeDomain] ?? []

  return (
    <div className="action-menu">
      <div className="action-menu__header">
        <h3 className="panel-title">Available Actions</h3>
        <span className="action-menu__count">{allAvailable.length} available</span>
      </div>

      <div className="domain-tabs" role="tablist" aria-label="Action domains">
        {Object.entries(DOMAIN_CONFIG).map(([domain, config]) => {
          const count = byDomain[domain]?.length ?? 0
          return (
            <button
              key={domain}
              role="tab"
              aria-selected={activeDomain === domain}
              className={`domain-tab ${config.class}${activeDomain === domain ? ' domain-tab--active' : ''}`}
              onClick={() => setActiveDomain(domain)}
            >
              {config.label}
              <span className="domain-tab__count">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="action-list" role="tabpanel" aria-label={`${DOMAIN_CONFIG[activeDomain].label} actions`}>
        {displayed.length === 0 ? (
          <div className="action-list__empty">
            No actions available in this domain at current escalation level.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table action-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Risk</th>
                  <th>Cost</th>
                  <th>Effect</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(action => {
                  const risk = adversaryState
                    ? computeRiskProfile(action, playerState, adversaryState)
                    : null

                  return (
                    <tr
                      key={action.id}
                      className={action.de_escalation ? 'tr--deescalate' : ''}
                    >
                      <td>
                        <div className="td-name">{action.name}</div>
                        <div className="td-sub">{action.description}</div>
                        <div className="td-chips">
                          {action.attribution_risk > 0 && (
                            <span className="cost-chip">
                              Attribution risk {Math.round(action.attribution_risk * 100)}%
                            </span>
                          )}
                          {action.counter_strike_risk > 0 && (
                            <span className="cost-chip">
                              Counter Strike Risk {Math.round(action.counter_strike_risk * 100)}%
                            </span>
                          )}
                          {action.ongoing ? (
                              <span className="cost-chip">Ongoing</span>
                          ) : <span className="cost-chip">One Time</span> }
                          <span className={`cost-chip`}>
                            {REVERSIBILITY_LABELS[action.reversibility]}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="action-card__badges">
                          {risk && !action.de_escalation && (
                            <span className={`badge ${RISK_CONFIG[risk.riskLevel].class}`}>
                              {RISK_CONFIG[risk.riskLevel].label}
                            </span>
                          )}
                          {action.de_escalation && (
                            <span className="badge badge--deescalate">De-escalation</span>
                          )}
                          {action.escalates_to >= 7 && !action.de_escalation && (
                            <span className="badge badge--kinetic">Kinetic</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {Object.keys(action.self_cost ?? {}).length > 0
                          ? Object.entries(action.self_cost).map(([dim, amt]) => {
                              const range = risk && !action.de_escalation
                                ? getCostRange(amt, risk.costRange)
                                : null
                              const insufficient = (playerState.power[dim] ?? 0) < amt
                              return (
                                <span key={dim} className={`cost-chip cost-chip--self${insufficient ? ' cost-chip--insufficient' : ''}`}>
                                  {range ? `${range[0]} to ${range[1]}` : `${amt}`} {formatDim(dim)}
                                </span>
                              )
                            })
                          : <span className="td-none">—</span>}
                      </td>
                      <td>
                        {Object.keys(action.enemy_effect ?? {}).length > 0
                          ? Object.entries(action.enemy_effect).map(([dim, amt]) => {
                              const range = risk && !action.de_escalation
                                ? getEffectRange(amt, risk.effectRange)
                                : null
                              return (
                                <span key={dim} className="cost-chip cost-chip--effect">
                                  {range ? `-${range[0]} to -${range[1]}` : `-${amt}`} {formatDim(dim)}
                                </span>
                              )
                            })
                          : <span className="td-none">—</span>}
                      </td>
                      <td className="td-action">
                        <button
                          className={`btn ${action.de_escalation ? 'btn--secondary' : 'btn--primary'} btn--sm`}
                          onClick={() => onSelectAction(action)}
                          disabled={!canAfford(action, playerState.power)}
                          title={!canAfford(action, playerState.power) ? 'Insufficient power to execute' : undefined}
                          aria-label={`Execute: ${action.name}`}
                        >
                          Execute
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function canAfford(action, power) {
  for (const [dim, amt] of Object.entries(action.self_cost ?? {})) {
    if ((power[dim] ?? 0) < amt) return false
  }
  return true
}

function getCostRange(base, [min, max]) {
  return [Math.round(base * min), Math.round(base * max)]
}

function getEffectRange(base, [min, max]) {
  return [Math.round(base * min), Math.round(base * max)]
}

function formatDim(dim) {
  const labels = {
    military: 'Mil',
    economic: 'Econ',
    information: 'Info',
    political: 'Pol',
    covert: 'Cov',
  }
  return labels[dim] ?? dim
}
