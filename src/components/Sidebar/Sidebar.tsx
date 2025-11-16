import { currentView, sidebarCollapsed, calendarToken } from '@/store/store';
import { createNote } from '@/utils/noteActions';
import { authenticateWithGoogle, disconnectGoogleCalendar, isCalendarConnected } from '@/utils/googleCalendar';

export default function Sidebar() {
  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  };

  const navigateToGlance = () => {
    currentView.value = 'glance';
  };

  const navigateToTasks = () => {
    currentView.value = 'tasks';
  };

  const navigateToNotes = () => {
    currentView.value = 'notes';
  };

  const handleAddNote = () => {
    createNote();
  };

  const handleCalendarConnect = async () => {
    try {
      if (isCalendarConnected()) {
        disconnectGoogleCalendar();
      } else {
        await authenticateWithGoogle();
        // Fetch events will be triggered by App.tsx on load
      }
    } catch (error) {
      console.error('Calendar connection error:', error);
      alert('Failed to connect to Google Calendar. Please try again.');
    }
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
            <div
              class={`sidebar-item sidebar-nav-item ${currentView.value === 'glance' ? 'active' : ''}`}
              onClick={navigateToGlance}
            >
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
              <div
                class={`sidebar-section-header ${currentView.value === 'tasks' ? 'active' : ''}`}
                onClick={navigateToTasks}
              >
                <svg class="sidebar-section-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <span class="sidebar-section-title">TASKS</span>
              </div>
            </div>

            {/* Notes Section - Clickable header navigates to view */}
            <div class="sidebar-section-simple">
              <div
                class={`sidebar-section-header ${currentView.value === 'notes' ? 'active' : ''}`}
                onClick={navigateToNotes}
              >
                <svg class="sidebar-section-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span class="sidebar-section-title">NOTES</span>
                <div class="sidebar-section-actions">
                  <button
                    class="sidebar-section-add-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddNote();
                    }}
                    title="Add note"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="sidebar-footer">
            <button
              class={`settings-btn ${calendarToken.value ? 'calendar-connected' : ''}`}
              onClick={handleCalendarConnect}
              title={calendarToken.value ? 'Disconnect Google Calendar' : 'Connect Google Calendar'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>{calendarToken.value ? 'Calendar' : 'Connect Calendar'}</span>
            </button>
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
