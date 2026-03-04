const DOMAIN_CLASS = {
  non_military: 'tag--non-military',
  information: 'tag--information',
  military: 'tag--military',
}

const DOMAIN_LABEL = {
  non_military: 'Non-Mil',
  information: 'Info',
  military: 'Mil',
}

export default function ActiveOps({ activeOps, adversaryActiveOps, onCancel }) {
  const hasPlayerOps = activeOps.length > 0
  const hasAdversaryOps = adversaryActiveOps.length > 0

  return (
    <div className="active-ops-panel">
      <div className="panel-header">
        <h3 className="panel-title">Active Operations</h3>
      </div>

      {!hasPlayerOps && !hasAdversaryOps ? (
        <p className="ops-empty">No ongoing operations.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Operation</th>
                <th>Domain</th>
                <th>Self / Turn</th>
                <th>Adv Effect</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {hasPlayerOps && (
                <>
                  <tr className="tr-group-header">
                    <td colSpan={5}>Your Operations</td>
                  </tr>
                  {activeOps.map(op => (
                    <tr key={op.id}>
                      <td className="td-name">{op.name}</td>
                      <td>
                        <span className={`op-domain-tag ${DOMAIN_CLASS[op.domain]}`}>
                          {DOMAIN_LABEL[op.domain]}
                        </span>
                      </td>
                      <td>
                        {op.ongoing_self_cost
                          ? Object.entries(op.ongoing_self_cost).map(([dim, amt]) => (
                              <span key={dim} className="op-cost op-cost--self">−{amt} {dim.slice(0, 3).toUpperCase()}</span>
                            ))
                          : <span className="td-none">—</span>}
                      </td>
                      <td>
                        {op.ongoing_enemy_effect
                          ? Object.entries(op.ongoing_enemy_effect).map(([dim, amt]) => (
                              <span key={dim} className="op-cost op-cost--effect">−{amt} {dim.slice(0, 3).toUpperCase()}</span>
                            ))
                          : <span className="td-none">—</span>}
                      </td>
                      <td>
                        {onCancel && (
                          <button
                            className="op-cancel"
                            onClick={() => onCancel(op.id)}
                            aria-label={`Cancel operation: ${op.name}`}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {hasAdversaryOps && (
                <>
                  <tr className="tr-group-header">
                    <td colSpan={5}>Known Adversary Operations</td>
                  </tr>
                  {adversaryActiveOps.map(op => (
                    <tr key={op.id} className="tr--adversary">
                      <td className="td-name">{op.name}</td>
                      <td>
                        <span className={`op-domain-tag ${DOMAIN_CLASS[op.domain]}`}>
                          {DOMAIN_LABEL[op.domain]}
                        </span>
                      </td>
                      <td><span className="td-none">—</span></td>
                      <td>
                        {op.ongoing_enemy_effect
                          ? Object.entries(op.ongoing_enemy_effect).map(([dim, amt]) => (
                              <span key={dim} className="op-cost op-cost--self">−{amt} {dim.slice(0, 3).toUpperCase()} (you)</span>
                            ))
                          : <span className="td-none">—</span>}
                      </td>
                      <td></td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
