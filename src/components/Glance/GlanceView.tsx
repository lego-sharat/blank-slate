import { useComputed } from '@preact/signals';
import { todos, notes, nextEvent, currentView, isAuthenticated } from '@/store/store';
import { toggleTodo } from '@/utils/todoActions';
import { openNote } from '@/utils/noteActions';

export default function GlanceView() {
  const upcomingEvent = useComputed(() => nextEvent.value);
  const incompleteTasks = useComputed(() => todos.value.filter(t => !t.completed).slice(0, 3));
  const inProgressNotes = useComputed(() => notes.value.filter(n => n.status === 'draft').slice(0, 3));

  const formatTimeRange = (start: { dateTime?: string; date?: string }, end: { dateTime?: string; date?: string }): string => {
    if (start.dateTime && end.dateTime) {
      const startDate = new Date(start.dateTime);
      const endDate = new Date(end.dateTime);
      const startTime = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const endTime = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${startTime} - ${endTime}`;
    }
    return 'All day';
  };

  return (
    <div class="glance-view">
      <div class="glance-header">
        <h1 class="glance-title">Glance</h1>
      </div>

      <div class="glance-feed">
        {/* Next Event Section */}
        {isAuthenticated.value && upcomingEvent.value && (
          <div class="glance-section">
            <div class="glance-section-header">
              <h2 class="glance-section-title">Next Event</h2>
              <button class="glance-view-all" onClick={() => currentView.value = 'today'}>
                View all
              </button>
            </div>

            <div class="glance-event-card">
              <div class="glance-event-title">{upcomingEvent.value.summary}</div>
              <div class="glance-event-time">{formatTimeRange(upcomingEvent.value.start, upcomingEvent.value.end)}</div>
            </div>
          </div>
        )}

        {/* Tasks Section */}
        {incompleteTasks.value.length > 0 && (
          <div class="glance-section">
            <div class="glance-section-header">
              <h2 class="glance-section-title">Tasks</h2>
              <button class="glance-view-all" onClick={() => currentView.value = 'tasks'}>
                View all
              </button>
            </div>

            <div class="glance-tasks-list">
              {incompleteTasks.value.map(todo => (
                <div key={todo.id} class="glance-task-item">
                  <label class="glance-task-checkbox-wrapper">
                    <input
                      type="checkbox"
                      class="glance-task-checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id)}
                    />
                    <span class="glance-task-checkbox-custom"></span>
                  </label>
                  <span class="glance-task-text">{todo.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes Section */}
        {inProgressNotes.value.length > 0 && (
          <div class="glance-section">
            <div class="glance-section-header">
              <h2 class="glance-section-title">In Progress Notes</h2>
              <button class="glance-view-all" onClick={() => currentView.value = 'notes'}>
                View all
              </button>
            </div>

            <div class="glance-notes-list">
              {inProgressNotes.value.map(note => (
                <div
                  key={note.id}
                  class="glance-note-item"
                  onClick={() => openNote(note.id)}
                >
                  <div class="glance-note-title">{note.title || 'Untitled'}</div>
                  {note.content && (
                    <div class="glance-note-preview">
                      {note.content.substring(0, 80)}
                      {note.content.length > 80 && '...'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
