const DIM_ABBREV = {
  military: 'Mil',
  economic: 'Econ',
  information: 'Info',
  political: 'Pol',
  covert: 'Cov',
}

function CostChips({ costs, variant }) {
  const entries = Object.entries(costs ?? {}).filter(([, v]) => v > 0)
  if (!entries.length) return <span className="td-none">—</span>
  return (
    <>
      {entries.map(([dim, amt]) => (
        <span key={dim} className={`cost-chip cost-chip--${variant}`}>
          {variant === 'effect' ? '+' : '−'}{amt} {DIM_ABBREV[dim] ?? dim}
        </span>
      ))}
    </>
  )
}

function OutcomeBadge({ success, partial }) {
  if (success) return <span className="outcome-badge outcome-badge--success">Success</span>
  if (partial) return <span className="outcome-badge outcome-badge--partial">Partial</span>
  return <span className="outcome-badge outcome-badge--fail">Failed</span>
}

function AdvDelta({ delta }) {
  if (delta == null) return <span className="td-none">—</span>
  const cls = delta > 0 ? 'adv-delta--pos' : delta < 0 ? 'adv-delta--neg' : 'adv-delta--neutral'
  return <span className={`adv-delta ${cls}`}>{delta > 0 ? `+${delta}` : delta}</span>
}

export default function History({ history }) {
  if (history.length === 0) {
    return (
      <div className="history-panel">
        <div className="panel-header">
          <h3 className="panel-title">Turn History</h3>
        </div>
        <p className="history-empty">No turns recorded yet.</p>
      </div>
    )
  }

  const reversed = [...history].reverse()

  return (
    <div className="history-panel">
      <div className="panel-header">
        <h3 className="panel-title">Turn History</h3>
        <span className="panel-label">{history.length} turns</span>
      </div>

      <div className="table-wrap history-table-wrap">
        <table className="data-table history-table">
          <thead>
            <tr>
              <th>T</th>
              <th>Your Action</th>
              <th>Outcome</th>
              <th>Cost Paid</th>
              <th>Effect Dealt</th>
              <th>Adv Δ</th>
              <th>Adversary Action</th>
              <th>Effect on You</th>
              <th>Events</th>
            </tr>
          </thead>
          <tbody>
            {reversed.map(entry => (
              <>
                <tr key={entry.turn}>
                  <td className="td-turn" rowSpan={entry.player_narrative ? 2 : 1}>
                    T{entry.turn}
                  </td>
                  <td className="td-name">{entry.player_action}</td>
                  <td>
                    <OutcomeBadge success={entry.player_success} partial={entry.player_partial} />
                    {entry.player_attribution && (
                      <span className="event-tag event-tag--warn">Attributed</span>
                    )}
                    {entry.player_counter_strike && (
                      <span className="event-tag event-tag--danger">Counter-Strike</span>
                    )}
                  </td>
                  <td><CostChips costs={entry.player_cost} variant="self" /></td>
                  <td><CostChips costs={entry.player_effect} variant="effect" /></td>
                  <td><AdvDelta delta={entry.advantage_delta} /></td>
                  <td>
                    <span className="td-name">{entry.adversary_action}</span>
                    {' '}
                    <OutcomeBadge success={entry.adversary_success} partial={entry.adversary_partial} />
                  </td>
                  <td><CostChips costs={entry.adversary_effect} variant="self" /></td>
                  <td>
                    {entry.cascade_events?.length > 0 ? (
                      <div className="history-entry__events">
                        {entry.cascade_events.map((ev, i) => (
                          <span key={i} className={`history-event history-event--${ev.severity}`}>
                            {ev.type.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    ) : <span className="td-none">—</span>}
                  </td>
                </tr>
                {entry.player_narrative && (
                  <tr key={`${entry.turn}-narrative`} className="tr-narrative">
                    <td colSpan={8} className="td-narrative">{entry.player_narrative}</td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
