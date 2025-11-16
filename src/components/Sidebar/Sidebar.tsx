import { signal } from '@preact/signals';
import { todos, notes, readingList, todayEvents, currentView, sidebarCollapsed } from '@/store/store';
import SidebarSection from './SidebarSection';

// Track which sections are collapsed
const collapsedSections = signal<Record<string, boolean>>({
  calendar: false,
  tasks: false,
  notes: false,
  reading: false,
});

export default function Sidebar() {
  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  };

  const toggleSection = (sectionId: string) => {
    collapsedSections.value = {
      ...collapsedSections.value,
      [sectionId]: !collapsedSections.value[sectionId],
    };
  };

  const navigateToGlance = () => {
    currentView.value = 'glance';
  };

  const navigateToPlanner = () => {
    currentView.value = 'planner';
  };

  return (
    <aside class={`sidebar ${sidebarCollapsed.value ? 'collapsed' : ''}`}>
      <div class="sidebar-header">
        <button class="collapse-sidebar-btn" onClick={toggleSidebar} title="Collapse Sidebar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
        </button>
        <h1>SLATE</h1>
      </div>

      {!sidebarCollapsed.value && (
        <>
          <div class="sidebar-actions">
            <button class="sidebar-action-btn" onClick={navigateToGlance} title="Glance">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
              <span>Glance</span>
            </button>
            <button class="sidebar-action-btn" onClick={navigateToPlanner} title="Planner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>Planner</span>
            </button>
          </div>

          <div class="sidebar-sections">
            {/* Calendar Section */}
            <SidebarSection
              title="CALENDAR"
              icon="calendar"
              collapsed={collapsedSections.value.calendar}
              onToggle={() => toggleSection('calendar')}
              itemCount={todayEvents.value.length}
            >
              {todayEvents.value.slice(0, 5).map(event => (
                <div key={event.id} class="sidebar-item" onClick={() => {
                  // TODO: Navigate to event detail
                  console.log('View event:', event.id);
                }}>
                  <svg class="sidebar-item-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                  </svg>
                  <span class="sidebar-item-label">
                    {new Date(event.start.dateTime || event.start.date || '').toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: false
                    })} {event.summary}
                  </span>
                </div>
              ))}
              {todayEvents.value.length === 0 && (
                <div class="sidebar-item-empty">No events today</div>
              )}
            </SidebarSection>

            {/* Tasks Section */}
            <SidebarSection
              title="TASKS"
              icon="check-square"
              collapsed={collapsedSections.value.tasks}
              onToggle={() => toggleSection('tasks')}
              itemCount={todos.value.filter(t => !t.completed).length}
            >
              {todos.value.filter(t => !t.completed).slice(0, 5).map(todo => (
                <div key={todo.id} class="sidebar-item">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    class="sidebar-item-checkbox"
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => {
                      const todoItem = todos.value.find(t => t.id === todo.id);
                      if (todoItem) {
                        todoItem.completed = !todoItem.completed;
                        todos.value = [...todos.value];
                      }
                    }}
                  />
                  <span class="sidebar-item-label">{todo.text}</span>
                </div>
              ))}
              {todos.value.filter(t => !t.completed).length === 0 && (
                <div class="sidebar-item-empty">All done!</div>
              )}
            </SidebarSection>

            {/* Notes Section */}
            <SidebarSection
              title="NOTES"
              icon="file-text"
              collapsed={collapsedSections.value.notes}
              onToggle={() => toggleSection('notes')}
              itemCount={notes.value.length}
            >
              {notes.value.slice(0, 5).map(note => (
                <div key={note.id} class="sidebar-item" onClick={() => {
                  // TODO: Navigate to note
                  console.log('View note:', note.id);
                }}>
                  <svg class="sidebar-item-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span class="sidebar-item-label">{note.title}</span>
                  {note.status === 'draft' && (
                    <span class="sidebar-item-badge draft">draft</span>
                  )}
                </div>
              ))}
              {notes.value.length === 0 && (
                <div class="sidebar-item-empty">No notes yet</div>
              )}
              <button class="sidebar-add-item" onClick={() => {
                // TODO: Add new note
                console.log('Add note');
              }}>
                + Add note
              </button>
            </SidebarSection>

            {/* Reading List Section */}
            <SidebarSection
              title="READING LIST"
              icon="book"
              collapsed={collapsedSections.value.reading}
              onToggle={() => toggleSection('reading')}
              itemCount={readingList.value.filter(r => r.status === 'unread').length}
            >
              {readingList.value.filter(r => r.status === 'unread').slice(0, 5).map(item => (
                <div key={item.id} class="sidebar-item" onClick={() => {
                  if (item.url) window.open(item.url, '_blank');
                }}>
                  <svg class="sidebar-item-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                  </svg>
                  <span class="sidebar-item-label">{item.title}</span>
                </div>
              ))}
              {readingList.value.filter(r => r.status === 'unread').length === 0 && (
                <div class="sidebar-item-empty">Nothing to read</div>
              )}
              <button class="sidebar-add-item" onClick={() => {
                // TODO: Add reading item
                console.log('Add reading item');
              }}>
                + Add item
              </button>
            </SidebarSection>
          </div>

          <div class="sidebar-footer">
            <button class="settings-btn" title="Theme">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              <span>Theme</span>
            </button>
            <button class="settings-btn" title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M1 12h6m6 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24"/>
              </svg>
              <span>Settings</span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
