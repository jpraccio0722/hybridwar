import { buildIntelBrief } from '../utils/fogOfWar'

const DIM_LABELS = {
  military: 'Military Posture',
  economic: 'Economic Condition',
  information: 'Information Posture',
  political: 'Political Standing',
  covert: 'Covert Capacity',
}

const CONF_CLASS = {
  HIGH: 'conf--high',
  MODERATE: 'conf--moderate',
  LOW: 'conf--low',
  VERY_LOW: 'conf--very-low',
}

export default function IntelPanel({ adversaryPower, intelligenceAccuracy, adversaryName }) {
  const brief = buildIntelBrief(adversaryPower, intelligenceAccuracy)

  return (
    <div className="intel-panel">
      <div className="panel-header">
        <h3 className="panel-title">Intelligence Assessment</h3>
        <span className="panel-label panel-label--classified">EYES ONLY</span>
      </div>

      <div className="intel-subject">
        Adversary State: <strong>{adversaryName}</strong>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Assessment</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(brief).map(([dim, { descriptor, confidence }]) => (
              <tr key={dim}>
                <td className="td-label">{DIM_LABELS[dim]}</td>
                <td><span className="intel-descriptor">"{descriptor}"</span></td>
                <td>
                  <span className={`conf-badge`}>
                    {confidence.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="intel-footer">
        <span className="intel-note">
          Accuracy determined by Covert Power delta. Estimates may vary by ±{getVarianceBand(intelligenceAccuracy)}.
        </span>
      </div>
    </div>
  )
}

function getVarianceBand(accuracy) {
  const confidences = Object.values(accuracy)
  const worst = confidences.includes('VERY_LOW') ? 'VERY_LOW'
    : confidences.includes('LOW') ? 'LOW'
    : confidences.includes('MODERATE') ? 'MODERATE'
    : 'HIGH'
  return {
    HIGH: '1 descriptor band',
    MODERATE: '2 descriptor bands',
    LOW: '3 descriptor bands',
    VERY_LOW: '3+ descriptor bands',
  }[worst]
}
