import { useSignal } from '@preact/signals';
import { thoughts } from '@/store/store';
import { createThought, openThought, deleteThought, reorderThoughts } from '@/utils/thoughtActions';

export default function ThoughtsView() {
  const draggedIndex = useSignal<number | null>(null);
  const dragOverIndex = useSignal<number | null>(null);

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

  const handleDragStart = (index: number) => {
    draggedIndex.value = index;
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault(); // Allow drop
    if (draggedIndex.value !== null && draggedIndex.value !== index) {
      dragOverIndex.value = index;
    }
  };

  const handleDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex.value !== null && draggedIndex.value !== dropIndex) {
      reorderThoughts(draggedIndex.value, dropIndex);
    }
    draggedIndex.value = null;
    dragOverIndex.value = null;
  };

  const handleDragEnd = () => {
    draggedIndex.value = null;
    dragOverIndex.value = null;
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
        {thoughts.value.map((thought, index) => (
          <div
            key={thought.id}
            class={`thought-card ${draggedIndex.value === index ? 'dragging' : ''} ${dragOverIndex.value === index && draggedIndex.value !== index ? 'drop-target' : ''}`}
            onClick={() => handleOpenThought(thought.id)}
            draggable={true}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          >
            <div class="thought-card-header">
              <div class="thought-card-drag-handle" title="Drag to reorder">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="4" y1="8" x2="20" y2="8"/>
                  <line x1="4" y1="16" x2="20" y2="16"/>
                </svg>
              </div>
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
