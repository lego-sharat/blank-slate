import { notes } from '@/store/store';
import { createNote, openNote, deleteNote } from '@/utils/noteActions';

export default function NotesView() {
  const handleAddNote = () => {
    createNote();
  };

  const handleOpenNote = (id: number) => {
    openNote(id);
  };

  const handleDeleteNote = (e: Event, id: number) => {
    e.stopPropagation();
    if (confirm('Delete this note?')) {
      deleteNote(id);
    }
  };

  return (
    <div class="notes-view">
      <div class="notes-header">
        <h1 class="notes-title">Notes</h1>
        <div class="notes-stats">
          {notes.value.length} {notes.value.length === 1 ? 'note' : 'notes'}
        </div>
      </div>

      <div class="notes-grid">
        {/* Add Note Card */}
        <div class="note-card add-note-card" onClick={handleAddNote}>
          <div class="add-note-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <div class="add-note-text">New Note</div>
        </div>

        {/* Note Cards */}
        {notes.value.map(note => (
          <div
            key={note.id}
            class="note-card"
            onClick={() => handleOpenNote(note.id)}
          >
            <div class="note-card-header">
              <h3 class="note-card-title">{note.title || 'Untitled'}</h3>
              <button
                class="note-card-delete"
                onClick={(e) => handleDeleteNote(e, note.id)}
                title="Delete note"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div class="note-card-preview">
              {note.content.substring(0, 150) || 'No content'}
            </div>
            <div class="note-card-footer">
              {note.status === 'draft' && (
                <span class="note-card-badge draft">draft</span>
              )}
              <span class="note-card-date">
                {new Date(note.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {notes.value.length === 0 && (
        <div class="notes-empty">
          No notes yet. Click the card above to create your first note.
        </div>
      )}
    </div>
  );
}
