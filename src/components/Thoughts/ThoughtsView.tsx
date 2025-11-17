import { thoughts } from '@/store/store';
import { createThought, openThought, deleteThought } from '@/utils/thoughtActions';

export default function ThoughtsView() {
  const handleAddThought = () => {
    createThought();
  };

  const handleOpenThought = (id: number) => {
    openThought(id);
  };

  const handleDeleteThought = (e: Event, id: number) => {
    e.stopPropagation();
    if (confirm('Delete this thought?')) {
      deleteThought(id);
    }
  };

  return (
    <div class="thoughts-view">
      <div class="thoughts-header">
        <h1 class="thoughts-title">Thoughts</h1>
        <div class="thoughts-stats">
          {thoughts.value.length} {thoughts.value.length === 1 ? 'thought' : 'thoughts'}
        </div>
      </div>

      <div class="thoughts-grid">
        {/* Add Thought Card */}
        <div class="thought-card add-thought-card" onClick={handleAddThought}>
          <div class="add-thought-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <div class="add-thought-text">New Thought</div>
        </div>

        {/* Thought Cards */}
        {thoughts.value.map(thought => (
          <div
            key={thought.id}
            class="thought-card"
            onClick={() => handleOpenThought(thought.id)}
          >
            <div class="thought-card-header">
              <h3 class="thought-card-title">{thought.title || 'Untitled'}</h3>
              <button
                class="thought-card-delete"
                onClick={(e) => handleDeleteThought(e, thought.id)}
                title="Delete thought"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div class="thought-card-preview">
              {thought.content.substring(0, 150) || 'No content'}
            </div>
            <div class="thought-card-footer">
              {thought.status === 'draft' && (
                <span class="thought-card-badge draft">draft</span>
              )}
              <span class="thought-card-date">
                {new Date(thought.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {thoughts.value.length === 0 && (
        <div class="thoughts-empty">
          No thoughts yet. Click the card above to create your first thought.
        </div>
      )}
    </div>
  );
}
