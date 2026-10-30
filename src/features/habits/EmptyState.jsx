const SUGGESTIONS = [
  { emoji: '🐕', name: 'Walk the dog' },
  { emoji: '🏃', name: 'Go for a run' },
  { emoji: '💊', name: 'Take vitamins' },
  { emoji: '✨', name: 'Read 10 pages' },
]

// What a brand-new user sees: a warm welcome, one clear button, and a few
// ideas to start from (they open the add modal already filled in).
function EmptyState({ onAdd }) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <div className="empty-art" aria-hidden="true">
        <span>🐕</span>
        <span>🏃</span>
        <span>💊</span>
      </div>
      <h2 id="empty-title">Let’s start your first habit</h2>
      <p className="empty-text">
        Pick something small you’d like to do every day. Tick it off for each day and watch your
        streak grow.
      </p>
      <button type="button" className="button-primary add-button" onClick={() => onAdd()}>
        Add your first habit
      </button>
      <p className="empty-ideas-label">Or start with one of these</p>
      <ul className="empty-ideas">
        {SUGGESTIONS.map((idea) => (
          <li key={idea.name}>
            <button type="button" className="idea-chip" onClick={() => onAdd(idea)}>
              <span aria-hidden="true">{idea.emoji}</span> {idea.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default EmptyState
