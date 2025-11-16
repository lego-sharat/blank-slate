import { currentView, sidebarCollapsed, isAuthenticated } from '@/store/store';
import { createNote } from '@/utils/noteActions';
import { signIn, getUserInitials } from '@/utils/auth';

export default function Sidebar() {
  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  };

  const navigateToGlance = () => {
    currentView.value = 'glance';
  };

  const navigateToToday = () => {
    currentView.value = 'today';
  };

  const navigateToLinear = () => {
    currentView.value = 'linear';
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

  const handleProfileClick = async () => {
    if (!isAuthenticated.value) {
      // Check if Supabase credentials are configured
      const supabaseUrl = localStorage.getItem('supabase_url');
      const supabaseKey = localStorage.getItem('supabase_anon_key');

      if (!supabaseUrl || !supabaseKey || supabaseUrl === 'https://your-project.supabase.co' || supabaseKey === 'your-anon-key') {
        // Credentials not configured, prompt user to go to settings
        const goToSettings = confirm(
          'Supabase credentials are not configured.\n\n' +
          'Please configure your Supabase project URL and anon key in Settings to enable Google sign-in.\n\n' +
          'Would you like to go to Settings now?'
        );

        if (goToSettings) {
          currentView.value = 'settings';
        }
        return;
      }

      // Sign in with Google
      try {
        await signIn();
      } catch (error) {
        console.error('Sign in error:', error);
        alert('Failed to sign in. Please try again.');
      }
    } else {
      // Show profile/settings view
      currentView.value = 'profile';
    }
  };

  const handleSettingsClick = () => {
    currentView.value = 'settings';
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

            {/* Today Section - Simple clickable item */}
            <div
              class={`sidebar-item sidebar-nav-item ${currentView.value === 'today' ? 'active' : ''}`}
              onClick={navigateToToday}
            >
              <svg class="sidebar-item-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span class="sidebar-item-label">Today</span>
            </div>

            {/* Linear Section - Simple clickable item */}
            <div
              class={`sidebar-item sidebar-nav-item ${currentView.value === 'linear' ? 'active' : ''}`}
              onClick={navigateToLinear}
            >
              <svg class="sidebar-item-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span class="sidebar-item-label">Linear</span>
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
              class="profile-btn"
              onClick={handleProfileClick}
              title={isAuthenticated.value ? 'Profile' : 'Sign in with Google'}
            >
              {isAuthenticated.value ? (
                <div class="profile-avatar">{getUserInitials()}</div>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              )}
            </button>
            <button
              class="settings-icon-btn"
              onClick={handleSettingsClick}
              title="Settings"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
