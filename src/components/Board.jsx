import { useState } from 'react'
import PowerPanel from './PowerPanel'
import IntelPanel from './IntelPanel'
import DomainBar from './DomainBar'
import ActionMenu from './ActionMenu'
import ActiveOps from './ActiveOps'
import History from './History'
import WinConditions from './WinConditions'

const TABS = [
  { id: 'situation', label: 'Situation' },
  { id: 'intel', label: 'Intel' },
  { id: 'actions', label: 'Actions' },
  { id: 'history', label: 'History' },
]

export default function Board({ gameState, turn, onPlayerAction, onCancelOperation }) {
  const [activeTab, setActiveTab] = useState('situation')
  const { player, adversary, intelligence_accuracy, history, win_conditions } = gameState

  return (
    <div className="board">
      <DomainBar
        playerDomains={player.domain_levels}
        adversaryDomains={adversary.domain_levels}
        turn={turn}
        strategicAdvantage={gameState.strategicAdvantage ?? 0}
      />

      {/* Mobile tab navigation */}
      <nav className="mobile-tabs" aria-label="Game sections">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`mobile-tab${activeTab === tab.id ? ' mobile-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Mobile: single panel at a time */}
      <div className="board-mobile">
        {activeTab === 'situation' && (
          <div className="board-section">
            <PowerPanel
              power={player.power}
              stateName={player.name}
              side="player"
            />
            <WinConditions
              winConditions={win_conditions}
              adversaryPower={adversary.power}
            />
            <ActiveOps
              activeOps={player.active_operations}
              adversaryActiveOps={adversary.active_operations}
              onCancel={onCancelOperation}
            />
          </div>
        )}
        {activeTab === 'intel' && (
          <div className="board-section">
            <IntelPanel
              adversaryPower={adversary.power}
              intelligenceAccuracy={intelligence_accuracy}
              adversaryName={adversary.name}
            />
          </div>
        )}
        {activeTab === 'actions' && (
          <div className="board-section">
            <ActionMenu
              playerState={player}
              adversaryState={adversary}
              onSelectAction={onPlayerAction}
            />
          </div>
        )}
        {activeTab === 'history' && (
          <div className="board-section">
            <History history={history} />
          </div>
        )}
      </div>

      {/* Desktop: two-column layout */}
      <div className="board-desktop">
        <div className="board-desktop__left">
          <PowerPanel
            power={player.power}
            stateName={player.name}
            side="player"
          />
          <WinConditions
            winConditions={win_conditions}
            adversaryPower={adversary.power}
          />
          <IntelPanel
            adversaryPower={adversary.power}
            intelligenceAccuracy={intelligence_accuracy}
            adversaryName={adversary.name}
          />
          <ActiveOps
            activeOps={player.active_operations}
            adversaryActiveOps={adversary.active_operations}
            onCancel={onCancelOperation}
          />
          <History history={history} />
        </div>
        <div className="board-desktop__right">
          <ActionMenu
            playerState={player}
            adversaryState={adversary}
            onSelectAction={onPlayerAction}
          />
        </div>
      </div>
    </div>
  )
}
