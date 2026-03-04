const DIM_LABELS = {
  military: 'Military',
  economic: 'Economic',
  information: 'Information',
  political: 'Political',
  covert: 'Covert',
}

function dimProgress(current, threshold) {
  if (current <= threshold) return 100
  return Math.round(((100 - current) / (100 - threshold)) * 100)
}

function getConditionMetrics(cond, adversaryPower) {
  switch (cond.check) {
    case 'adversary_dim_below': {
      const current = adversaryPower[cond.dim] ?? 0
      return {
        achieved: current < cond.threshold,
        metrics: [{
          dim: cond.dim,
          label: DIM_LABELS[cond.dim] ?? cond.dim,
          current,
          threshold: cond.threshold,
          progress: dimProgress(current, cond.threshold),
        }],
      }
    }
    case 'adversary_multi_below': {
      const metrics = cond.dims.map((dim, i) => {
        const current = adversaryPower[dim] ?? 0
        return {
          dim,
          label: DIM_LABELS[dim] ?? dim,
          current,
          threshold: cond.thresholds[i],
          progress: dimProgress(current, cond.thresholds[i]),
        }
      })
      return { achieved: metrics.every(m => m.current < m.threshold), metrics }
    }
    case 'adversary_dims_critical': {
      const allDims = Object.entries(adversaryPower)
      const critical = allDims.filter(([, v]) => v < cond.threshold)
      const metrics = allDims.map(([dim, current]) => ({
        dim,
        label: DIM_LABELS[dim] ?? dim,
        current,
        threshold: cond.threshold,
        progress: dimProgress(current, cond.threshold),
      })).sort((a, b) => b.progress - a.progress)
      return {
        achieved: critical.length >= cond.min_count,
        metrics,
        summary: `${critical.length} / ${cond.min_count} critical`,
      }
    }
    default:
      return { achieved: false, metrics: [] }
  }
}

export default function WinConditions({ winConditions, adversaryPower }) {
  if (!winConditions?.player?.length) return null

  const conditions = winConditions.player.map(cond => ({
    ...cond,
    ...getConditionMetrics(cond, adversaryPower),
  }))

  return (
    <div className="win-conditions-panel">
      <div className="panel-header">
        <h3 className="panel-title">Victory Objectives</h3>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Objective</th>
              <th>Targets</th>
              <th>Progress</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {conditions.map(cond => (
              <tr key={cond.id} className={cond.achieved ? 'tr--achieved' : ''}>
                <td>
                  <div className="td-name">{cond.label}</div>
                  <div className="td-sub">{cond.description}</div>
                  {cond.summary && <div className="td-summary">{cond.summary}</div>}
                </td>
                <td>
                  {cond.metrics.map(m => (
                    <div key={m.dim} className="td-metric">
                      <span className="td-metric__dim">{m.label}</span>
                      <span className="td-metric__val">{'<'} {m.threshold}</span>
                    </div>
                  ))}
                </td>
                <td className="td-bars">
                  {cond.metrics.map(m => (
                    <div key={m.dim} className="td-bar-row">
                      <div className="win-cond__bar" role="progressbar" aria-valuenow={m.progress} aria-valuemin={0} aria-valuemax={100}>
                        <div
                          className={`win-cond__fill${m.progress >= 100 ? ' win-cond__fill--done' : ''}`}
                          style={{ width: `${Math.min(m.progress, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </td>
                <td className="td-status">
                  {cond.achieved
                    ? <span className="win-cond__badge">ACHIEVED</span>
                    : <span className="td-none">Pending</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
