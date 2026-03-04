import { useState } from 'react'
import scenarios from '../data/scenarios.json'

export default function Setup({ onStartGame }) {
  const [selected, setSelected] = useState(null)

  return (
    <div className="setup-screen">
      <header className="setup-header">
        <div className="setup-logo">
          <span className="logo-mark">Hybrid Warfare Simulator</span>
        </div>
        <p className="setup-tagline">
          A turn-based strategic wargame grounded in the Gerasimov model of hybrid conflict.
          Engage across three domains: non-military, information, and military.
        </p>
      </header>

      <section className="setup-scenarios">
        <h2 className="section-title">Select Scenario</h2>
        <div className="scenario-grid">
          {scenarios.map(scenario => (
            <button
              key={scenario.id}
              className={`scenario-card${selected?.id === scenario.id ? ' scenario-card--selected' : ''}`}
              onClick={() => setSelected(scenario)}
              aria-pressed={selected?.id === scenario.id}
            >
              <div className="scenario-card__phase">Scenario {scenario.conflict_phase}</div>
              <h3 className="scenario-card__name">{scenario.name}</h3>
              <p className="scenario-card__tagline">{scenario.tagline}</p>
              <div className="scenario-card__factions">
                <span className="faction faction--player">{scenario.player.name}</span>
                <span className="faction-vs">vs</span>
                <span className="faction faction--adversary">{scenario.adversary.name}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <section className="setup-briefing" aria-live="polite">
          <h2 className="section-title">Scenario Briefing</h2>
          <div className="briefing-card">
            <h3 className="briefing-title">{selected.name}</h3>
            <p className="briefing-text">{selected.briefing}</p>

            <div className="briefing-factions">
              <div className="briefing-faction briefing-faction--player">
                <div className="briefing-faction__label">You command</div>
                <div className="briefing-faction__name">{selected.player.name}</div>
                <div className="briefing-faction__doctrine">{selected.player.doctrine_label}</div>
                <div className="briefing-power-grid">
                  {Object.entries(selected.player.power).map(([dim, val]) => (
                    <div key={dim} className="briefing-power-row">
                      <span className="briefing-power-label">{formatDim(dim)}</span>
                      <div className="briefing-power-bar-wrap">
                        <div
                          className="briefing-power-bar"
                          style={{ width: `${val}%` }}
                          aria-label={`${val} out of 100`}
                        />
                      </div>
                      <span className="briefing-power-val">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="briefing-faction briefing-faction--adversary">
                <div className="briefing-faction__label">Adversary</div>
                <div className="briefing-faction__name">{selected.adversary.name}</div>
                <div className="briefing-faction__doctrine">{selected.adversary.doctrine_label}</div>
                <div className="briefing-power-grid">
                  {Object.entries(selected.adversary.power).map(([dim, val]) => (
                    <div key={dim} className="briefing-power-row">
                      <span className="briefing-power-label">{formatDim(dim)}</span>
                      <div className="briefing-power-bar-wrap">
                        <div
                          className="briefing-power-bar briefing-power-bar--adversary"
                          style={{ width: `${val}%` }}
                          aria-label={`${val} out of 100`}
                        />
                      </div>
                      <span className="briefing-power-val">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selected.win_conditions && (
              <div className="briefing-objectives">
                <div className="briefing-objectives__section">
                  <div className="briefing-objectives__heading briefing-objectives__heading--player">
                    Your Victory Objectives
                    <span className="briefing-objectives__subhead">Achieve any one to win</span>
                  </div>
                  <ul className="briefing-objectives__list">
                    {selected.win_conditions.player.map(cond => (
                      <li key={cond.id} className="briefing-objective">
                        <span className="briefing-objective__label">{cond.label}</span>
                        <span className="briefing-objective__desc">{cond.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="briefing-objectives__section">
                  <div className="briefing-objectives__heading briefing-objectives__heading--adversary">
                    {selected.adversary.name}&rsquo;s Objectives
                    <span className="briefing-objectives__subhead">What you must prevent</span>
                  </div>
                  <ul className="briefing-objectives__list">
                    {selected.win_conditions.adversary.map(cond => (
                      <li key={cond.id} className="briefing-objective briefing-objective--threat">
                        <span className="briefing-objective__label">{cond.label}</span>
                        <span className="briefing-objective__desc">{cond.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <button
              className="btn btn--primary btn--large"
              onClick={() => onStartGame(selected)}
            >
              Begin Operation
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function formatDim(dim) {
  const labels = {
    military: 'Military',
    economic: 'Economic',
    information: 'Information',
    political: 'Political',
    covert: 'Covert',
  }
  return labels[dim] ?? dim
}
