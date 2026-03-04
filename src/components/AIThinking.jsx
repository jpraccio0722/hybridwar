export default function AIThinking({ adversaryName, doctrineLabel }) {
  return (
    <div className="ai-thinking-screen">
      <div className="ai-thinking-card">
        <div className="ai-thinking__crest" aria-hidden="true">
          <div className="ai-thinking__pulse" />
          <span className="ai-thinking__icon">⚑</span>
        </div>
        <h2 className="ai-thinking__heading">Adversary Deliberating</h2>
        <p className="ai-thinking__name">{adversaryName}</p>
        <p className="ai-thinking__doctrine">{doctrineLabel}</p>
        <div className="ai-thinking__dots" aria-label="Processing">
          <span /><span /><span />
        </div>
        <p className="ai-thinking__subtext">Analysing strategic situation…</p>
      </div>
    </div>
  )
}
