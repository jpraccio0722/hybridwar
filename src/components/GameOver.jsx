export default function GameOver({ gameState, result, turn, onRestart }) {
  const { player, adversary } = gameState
  const isWin = result.winner === 'player'
  const isDraw = result.winner === 'draw'

  return (
    <div className="gameover-screen">
      <div className={`gameover-banner ${isWin ? 'gameover-banner--win' : isDraw ? 'gameover-banner--draw' : 'gameover-banner--loss'}`}>
        <div className="gameover-verdict">
          {isWin ? 'Strategic Objectives Achieved' : isDraw ? 'Stalemate' : 'Strategic Failure'}
        </div>
        <div className="gameover-subverdict">
          {isWin ? `${player.name} prevails` : isDraw ? 'No decisive victor' : `${adversary.name} achieves dominance`}
        </div>
        {result.conditionLabel && (
          <div className="gameover-condition-label">
            {result.conditionLabel}
          </div>
        )}
      </div>

      <div className="gameover-body">
        <div className="gameover-reason">
          <h2 className="gameover-reason__title">Assessment</h2>
          <p className="gameover-reason__text">{result.reason}</p>
          <p className="gameover-turns">Conflict duration: {turn} turn{turn !== 1 ? 's' : ''}</p>
        </div>

        <div className="gameover-final-state">
          <h3 className="gameover-state-title">Final Strategic Balance</h3>
          <div className="gameover-comparison">
            <div className="gameover-state">
              <div className={`gameover-state__header ${isWin ? 'gameover-state__header--win' : 'gameover-state__header--loss'}`}>
                {player.name}
              </div>
              {Object.entries(player.power).map(([dim, val]) => (
                <div key={dim} className="final-row">
                  <span className="final-dim">{formatDim(dim)}</span>
                  <div className="final-bar-wrap">
                    <div
                      className={`final-bar final-bar--player ${getBarClass(val)}`}
                      style={{ width: `${Math.max(2, val)}%` }}
                    />
                  </div>
                  <span className={`final-val ${getValClass(val)}`}>{val}</span>
                </div>
              ))}
            </div>

            <div className="gameover-state">
              <div className={`gameover-state__header ${!isWin && !isDraw ? 'gameover-state__header--win' : 'gameover-state__header--loss'}`}>
                {adversary.name}
              </div>
              {Object.entries(adversary.power).map(([dim, val]) => (
                <div key={dim} className="final-row">
                  <span className="final-dim">{formatDim(dim)}</span>
                  <div className="final-bar-wrap">
                    <div
                      className={`final-bar final-bar--adversary ${getBarClass(val)}`}
                      style={{ width: `${Math.max(2, val)}%` }}
                    />
                  </div>
                  <span className={`final-val ${getValClass(val)}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="gameover-history-summary">
          <h3 className="gameover-state-title">Operation Log</h3>
          <div className="history-brief">
            {gameState.history.map(entry => (
              <div key={entry.turn} className="history-brief__row">
                <span className="history-brief__turn">T{entry.turn}</span>
                <span className="history-brief__you">{entry.player_action}</span>
                <span className="history-brief__vs">vs</span>
                <span className="history-brief__adv">{entry.adversary_action}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="gameover-actions">
          <button className="btn btn--primary btn--large" onClick={onRestart}>
            New Scenario
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDim(dim) {
  const m = {
    military: 'Military', economic: 'Economic', information: 'Information',
    political: 'Political', covert: 'Covert',
  }
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
