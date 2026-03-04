import { buildSelfBrief } from '../utils/fogOfWar'

const DIM_LABELS = {
  military: 'Military',
  economic: 'Economic',
  information: 'Information',
  political: 'Political',
  covert: 'Covert',
}

const DIM_ABBREV = {
  military: 'MP',
  economic: 'EP',
  information: 'IP',
  political: 'PP',
  covert: 'CP',
}

function getScoreClass(score) {
  if (score >= 60) return 'power-bar--high'
  if (score >= 35) return 'power-bar--medium'
  if (score >= 15) return 'power-bar--low'
  return 'power-bar--critical'
}

function getScoreLabelClass(score) {
  if (score >= 60) return 'score-label--high'
  if (score >= 35) return 'score-label--medium'
  if (score >= 15) return 'score-label--low'
  return 'score-label--critical'
}

export default function PowerPanel({ power, stateName, side = 'player' }) {
  const brief = buildSelfBrief(power)

  return (
    <div className={`power-panel power-panel--${side}`}>
      <div className="panel-header">
        <h3 className="panel-title">{stateName}</h3>
        <span className="panel-label">{side === 'player' ? 'Your State' : 'Adversary'}</span>
      </div>

      <div className="power-rows">
        {Object.entries(power).map(([dim, score]) => (
          <div key={dim} className="power-row">
            <div className="power-row__meta">
              <span className="power-row__abbrev">{DIM_ABBREV[dim]}</span>
              <span className="power-row__name">{DIM_LABELS[dim]}</span>
            </div>
            <div className="power-row__bar-wrap">
              <div
                className={`power-bar ${getScoreClass(score)}`}
                style={{ width: `${Math.max(2, score)}%` }}
                role="progressbar"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${DIM_LABELS[dim]}: ${score}`}
              />
            </div>
            <span className={`power-row__score ${getScoreLabelClass(score)}`}>
              {score}
            </span>
          </div>
        ))}
      </div>

      <div className="power-descriptors">
        {Object.entries(brief).map(([dim, { descriptor }]) => (
          <div key={dim} className="descriptor-row">
            <span className="descriptor-dim">{DIM_ABBREV[dim]}</span>
            <span className="descriptor-text">{descriptor}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
