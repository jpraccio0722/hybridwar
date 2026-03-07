import { useState } from 'react'

export default function DebugDrawer({ log, open, onClose }) {
  function handleDownload() {
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stratsim-ai-debug.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {open && <div className="debug-overlay" onClick={onClose} />}
      <div className={`debug-drawer ${open ? 'debug-drawer--open' : ''}`} aria-hidden={!open}>
        <div className="debug-drawer__header">
          <span className="debug-drawer__title">AI Debug Log</span>
          <div className="debug-drawer__header-actions">
            <button
              className="debug-btn debug-btn--download"
              onClick={handleDownload}
              disabled={log.length === 0}
              title="Download as JSON"
            >
              ↓ JSON
            </button>
            <button className="debug-btn debug-btn--close" onClick={onClose} title="Close">✕</button>
          </div>
        </div>
        <div className="debug-drawer__body">
          {log.length === 0 ? (
            <p className="debug-empty">No AI moves recorded yet.</p>
          ) : (
            [...log].reverse().map((entry, i) => (
              <TurnEntry key={log.length - 1 - i} entry={entry} />
            ))
          )}
        </div>
      </div>
    </>
  )
}

function TurnEntry({ entry }) {
  const [showSystem, setShowSystem] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const sourceLabel = entry.source === 'llm' ? 'LLM' : entry.source === 'fallback' ? 'Fallback' : 'LLM Error'
  const sourceClass = entry.source === 'llm'
    ? 'debug-badge--llm'
    : entry.source === 'fallback'
      ? 'debug-badge--fallback'
      : 'debug-badge--error'

  const timeStr = entry.timestamp
    ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : ''

  return (
    <div className="debug-entry">
      <div className="debug-entry__header">
        <span className="debug-entry__turn">Turn {entry.turn}</span>
        <span className={`debug-badge ${sourceClass}`}>{sourceLabel}</span>
        <span className="debug-entry__time">{timeStr}</span>
      </div>

      {entry.actionId && (
        <div className="debug-field">
          <span className="debug-field__label">Action ID</span>
          <span className="debug-field__value debug-field__value--mono">{entry.actionId}</span>
        </div>
      )}
      {entry.fallbackAction && (
        <div className="debug-field">
          <span className="debug-field__label">Fallback Action</span>
          <span className="debug-field__value debug-field__value--mono">{entry.fallbackAction}</span>
        </div>
      )}
      {entry.escalationIntent && (
        <div className="debug-field">
          <span className="debug-field__label">Escalation Intent</span>
          <span className="debug-field__value">{entry.escalationIntent}</span>
        </div>
      )}
      {entry.publicStatement && (
        <div className="debug-field">
          <span className="debug-field__label">Public Statement</span>
          <span className="debug-field__value debug-field__value--italic">"{entry.publicStatement}"</span>
        </div>
      )}
      {entry.internalReasoning && (
        <div className="debug-field">
          <span className="debug-field__label">Internal Reasoning</span>
          <span className="debug-field__value">{entry.internalReasoning}</span>
        </div>
      )}
      {entry.error && (
        <div className="debug-field debug-field--error">
          <span className="debug-field__label">Error</span>
          <span className="debug-field__value debug-field__value--mono">{entry.error}</span>
        </div>
      )}

      <div className="debug-collapsibles">
        <CollapsibleSection
          label="System Prompt"
          open={showSystem}
          onToggle={() => setShowSystem(v => !v)}
          content={entry.systemPrompt}
        />
        <CollapsibleSection
          label="User Prompt"
          open={showUser}
          onToggle={() => setShowUser(v => !v)}
          content={entry.userPrompt}
        />
        <CollapsibleSection
          label="Raw Response"
          open={showRaw}
          onToggle={() => setShowRaw(v => !v)}
          content={entry.rawResponse != null ? JSON.stringify(entry.rawResponse, null, 2) : null}
        />
      </div>
    </div>
  )
}

function CollapsibleSection({ label, open, onToggle, content }) {
  if (!content) return null
  return (
    <div className="debug-collapsible">
      <button className="debug-collapsible__toggle" onClick={onToggle}>
        <span className="debug-collapsible__arrow">{open ? '▼' : '▶'}</span>
        {label}
      </button>
      {open && (
        <pre className="debug-collapsible__content">{content}</pre>
      )}
    </div>
  )
}
