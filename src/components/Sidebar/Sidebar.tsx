import { signal } from '@preact/signals';
import { todos, notes, currentView, sidebarCollapsed } from '@/store/store';
import SidebarSection from './SidebarSection';
import { createNote, openNote } from '@/utils/noteActions';

// Track which sections are collapsed (only Notes is collapsible)
const collapsedSections = signal<Record<string, boolean>>({
  notes: false,
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

  const navigateToTasks = () => {
    currentView.value = 'tasks';
  };

  const handleAddNote = () => {
    createNote();
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
          <div class="sidebar-sections">
            {/* Glance Section - Simple clickable item */}
            <div class="sidebar-item sidebar-nav-item" onClick={navigateToGlance}>
              <svg class="sidebar-item-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              <span class="sidebar-item-label">Glance</span>
            </div>

            {/* Tasks Section - Clickable header navigates to view */}
            <div class="sidebar-section-simple">
              <div class="sidebar-section-header" onClick={navigateToTasks}>
                <svg class="sidebar-section-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <span class="sidebar-section-title">TASKS</span>
                {todos.value.filter(t => !t.completed).length > 0 && (
                  <span class="sidebar-section-dot"></span>
                )}
              </div>
            </div>

            {/* Notes Section - Collapsible */}
            <SidebarSection
              title="NOTES"
              icon="file-text"
              collapsed={collapsedSections.value.notes}
              onToggle={() => toggleSection('notes')}
              showDot={notes.value.filter(n => n.status === 'draft').length > 0}
            >
              {notes.value.slice(0, 10).map(note => (
                <div key={note.id} class="sidebar-item" onClick={() => openNote(note.id)}>
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
              <button class="sidebar-add-item" onClick={handleAddNote}>
                + Add note
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
