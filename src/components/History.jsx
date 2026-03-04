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
        <table className="data-table">
          <thead>
            <tr>
              <th>Turn</th>
              <th>Your Action</th>
              <th>Adversary Action</th>
              <th>Events</th>
            </tr>
          </thead>
          <tbody>
            {reversed.map(entry => (
              <tr key={entry.turn}>
                <td className="td-turn">T{entry.turn}</td>
                <td>
                  <span className={`history-outcome ${entry.player_success ? 'history-outcome--success' : 'history-outcome--fail'}`}>
                    {entry.player_success ? '✓' : '~'}
                  </span>
                  {' '}
                  <span className="history-action">{entry.player_action}</span>
                </td>
                <td>
                  <span className={`history-outcome ${entry.adversary_success ? 'history-outcome--success' : 'history-outcome--fail'}`}>
                    {entry.adversary_success ? '✓' : '~'}
                  </span>
                  {' '}
                  <span className="history-action">{entry.adversary_action}</span>
                </td>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
