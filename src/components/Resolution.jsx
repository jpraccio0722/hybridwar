import { getAdvantageLabel } from '../utils/gameEngine'

const SEVERITY_CLASS = {
  info: 'cascade--info',
  warning: 'cascade--warning',
  danger: 'cascade--danger',
  success: 'cascade--success',
}

const ESCALATION_INTENT_CONFIG = {
  escalate:     { label: 'Escalating',    cls: 'intent-chip--escalate' },
  hold:         { label: 'Holding',       cls: 'intent-chip--hold' },
  'de-escalate': { label: 'De-escalating', cls: 'intent-chip--deescalate' },
}

export default function Resolution({ gameState, resolution, turn, onNextTurn }) {
  const { playerResult, adversaryResult, aiAction, aiReasoning, cascadeEvents,
    aiPublicStatement, aiEscalationIntent,
    advantageBefore, advantageAfter, advantageDelta } = resolution
  const { player, adversary } = gameState

  return (
    <div className="resolution-screen">
      <div className="resolution-header">
        <div className="resolution-header__turn">
          <span className="turn-label">Turn {turn} Resolution</span>
        </div>
        <h2 className="resolution-title">Operational Report</h2>
      </div>

      <div className="resolution-body">

        {/* Player action result */}
        <section className="resolution-section">
          <div className="resolution-section__header resolution-section__header--player">
            <span className="resolution-actor">{player.name}</span>
            <span className={`resolution-outcome ${playerResult.success ? 'outcome--success' : playerResult.partial ? 'outcome--partial' : 'outcome--failure'}`}>
              {playerResult.success ? 'Success' : playerResult.partial ? 'Partial' : 'Failed'}
            </span>
          </div>

          <div className="op-report">
            <div className="op-report__action">
              <span className="op-report__label">Action Taken:</span>
              <strong>{playerResult.actionName}</strong>
            </div>

            <div className="op-report__narrative">
              {playerResult.narrativeLines.map((line, i) => (
                <p key={i} className="narrative-line">{line}</p>
              ))}
            </div>

            <div className="op-report__ledger">
              {Object.keys(playerResult.costActual).length > 0 && (
                <div className="ledger-group">
                  <span className="ledger-label">Your costs:</span>
                  <div className="ledger-chips">
                    {Object.entries(playerResult.costActual).map(([dim, amt]) => (
                      <span key={dim} className="ledger-chip ledger-chip--cost">
                        −{amt} {formatDim(dim)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(playerResult.effectActual).length > 0 && (
                <div className="ledger-group">
                  <span className="ledger-label">Enemy losses:</span>
                  <div className="ledger-chips">
                    {Object.entries(playerResult.effectActual).map(([dim, amt]) => (
                      <span key={dim} className="ledger-chip ledger-chip--effect">
                        −{amt} {formatDim(dim)} (adv)
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(playerResult.self_benefit ?? {}).length > 0 && (
                <div className="ledger-group">
                  <span className="ledger-label">Your gains:</span>
                  <div className="ledger-chips">
                    {Object.entries(playerResult.self_benefit).map(([dim, amt]) => (
                      <span key={dim} className="ledger-chip ledger-chip--gain">
                        +{amt} {formatDim(dim)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(playerResult.failurePenalty ?? {}).length > 0 && (
                <div className="ledger-group ledger-group--blowback">
                  <span className="ledger-label ledger-label--blowback">Failure blowback:</span>
                  <div className="ledger-chips">
                    {Object.entries(playerResult.failurePenalty).map(([dim, amt]) => (
                      <span key={dim} className="ledger-chip ledger-chip--blowback">
                        −{amt} {formatDim(dim)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Adversary action result */}
        <section className="resolution-section">
          <div className="resolution-section__header resolution-section__header--adversary">
            <span className="resolution-actor">{adversary.name}</span>
            <span className={`resolution-outcome ${adversaryResult?.success ? 'outcome--success' : adversaryResult?.partial ? 'outcome--partial' : 'outcome--failure'}`}>
              {adversaryResult?.success ? 'Success' : adversaryResult?.partial ? 'Partial' : adversaryResult ? 'Failed' : 'No action'}
            </span>
          </div>

          <div className="op-report">
            {aiAction ? (
              <>
                <div className="op-report__action">
                  <span className="op-report__label">Action Taken:</span>
                  <strong>{aiAction.name}</strong>
                </div>
                {adversaryResult && (
                  <div className="op-report__narrative">
                    {adversaryResult.narrativeLines.map((line, i) => (
                      <p key={i} className="narrative-line">{line}</p>
                    ))}
                  </div>
                )}
                {adversaryResult && (
                  <div className="op-report__ledger">
                    {Object.keys(adversaryResult.effectActual).length > 0 && (
                      <div className="ledger-group">
                        <span className="ledger-label">Your losses:</span>
                        <div className="ledger-chips">
                          {Object.entries(adversaryResult.effectActual).map(([dim, amt]) => (
                            <span key={dim} className="ledger-chip ledger-chip--cost">
                              −{amt} {formatDim(dim)} (you)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {aiEscalationIntent && (() => {
                  const cfg = ESCALATION_INTENT_CONFIG[aiEscalationIntent] ?? ESCALATION_INTENT_CONFIG.hold
                  return (
                    <div className="adversary-intent">
                      <span className="adversary-intent__label">Posture:</span>
                      <span className={`intent-chip ${cfg.cls}`}>{cfg.label}</span>
                    </div>
                  )
                })()}
                {aiPublicStatement && (
                  <div className="adversary-statement">
                    <span className="adversary-statement__label">Public Statement</span>
                    <blockquote className="adversary-statement__text">"{aiPublicStatement}"</blockquote>
                  </div>
                )}
                <div className="adversary-reasoning">
                  <span className="adversary-reasoning__label">Internal Assessment:</span>
                  <p className="adversary-reasoning__text">{aiReasoning}</p>
                </div>
              </>
            ) : (
              <p className="narrative-line">Adversary took no action this turn.</p>
            )}
          </div>
        </section>

        {/* Cascade events */}
        {cascadeEvents.length > 0 && (
          <section className="resolution-section">
            <div className="resolution-section__header resolution-section__header--neutral">
              <span className="resolution-actor">Strategic Events</span>
            </div>
            <div className="cascade-events">
              {cascadeEvents.map((ev, i) => (
                <div key={i} className={`cascade-event ${SEVERITY_CLASS[ev.severity]}`}>
                  <span className="cascade-event__text">{ev.message}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Current state summary */}
        <section className="resolution-section resolution-section--summary">
          <div className="resolution-section__header resolution-section__header--neutral">
            <span className="resolution-actor">Current Strategic Balance</span>
          </div>

          {/* Strategic Advantage summary row */}
          {advantageAfter !== undefined && (
            <div className="advantage-resolution">
              <div className="advantage-resolution__row">
                <span className="advantage-resolution__heading">Strategic Advantage</span>
                <div className="advantage-resolution__right">
                  {advantageDelta !== 0 && (
                    <span className={`adv-chip ${advantageDelta > 0 ? 'adv-chip--gain' : 'adv-chip--loss'}`}>
                      {advantageDelta > 0 ? `▲ +${advantageDelta}` : `▼ ${advantageDelta}`}
                    </span>
                  )}
                  {advantageDelta === 0 && (
                    <span className="adv-chip adv-chip--neutral">— No change</span>
                  )}
                  <span className="advantage-resolution__label">
                    {getAdvantageLabel(advantageAfter)}&nbsp;
                    <span className={advantageAfter > 3 ? 'adv-val--positive' : advantageAfter < -3 ? 'adv-val--negative' : 'adv-val--neutral'}>
                      ({advantageAfter > 0 ? `+${advantageAfter}` : advantageAfter})
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="state-summary">
            <div className="state-summary__col">
              <div className="state-summary__name">{player.name}</div>
              {Object.entries(gameState.player.power).map(([dim, val]) => (
                <div key={dim} className="summary-row">
                  <span className="summary-dim">{formatDimFull(dim)}</span>
                  <div className="summary-bar-wrap">
                    <div
                      className={`summary-bar summary-bar--player ${getBarClass(val)}`}
                      style={{ width: `${Math.max(2, val)}%` }}
                    />
                  </div>
                  <span className={`summary-val ${getValClass(val)}`}>{val}</span>
                </div>
              ))}
            </div>
            <div className="state-summary__col">
              <div className="state-summary__name">{adversary.name}</div>
              {Object.entries(gameState.adversary.power).map(([dim, val]) => (
                <div key={dim} className="summary-row">
                  <span className="summary-dim">{formatDimFull(dim)}</span>
                  <div className="summary-bar-wrap">
                    <div
                      className={`summary-bar summary-bar--adversary ${getBarClass(val)}`}
                      style={{ width: `${Math.max(2, val)}%` }}
                    />
                  </div>
                  <span className={`summary-val ${getValClass(val)}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>

      <div className="resolution-footer">
        <button className="btn btn--primary btn--large" onClick={onNextTurn}>
          Begin Turn {turn + 1}
        </button>
      </div>
    </div>
  )
}

function formatDim(dim) {
  const m = { military: 'Mil', economic: 'Econ', information: 'Info', political: 'Pol', covert: 'Cov' }
  return m[dim] ?? dim
}

function formatDimFull(dim) {
  const m = { military: 'Military', economic: 'Economic', information: 'Information', political: 'Political', covert: 'Covert' }
  return m[dim] ?? dim
}

function getBarClass(val) {
  if (val >= 60) return 'bar--high'
  if (val >= 35) return 'bar--medium'
  if (val >= 15) return 'bar--low'
  return 'bar--critical'
}

function getValClass(val) {
  if (val >= 60) return 'val--high'
  if (val >= 35) return 'val--medium'
  if (val >= 15) return 'val--low'
  return 'val--critical'
}
