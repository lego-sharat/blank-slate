import { currentView, isAuthenticated } from '@/store/store';
import { signOut, getUserDisplayName, getUserEmail, getUserInitials } from '@/utils/auth';

export default function ProfileView() {
  const handleSignOut = async () => {
    try {
      await signOut();
      currentView.value = 'glance';
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  const handleBack = () => {
    currentView.value = 'glance';
  };

  if (!isAuthenticated.value) {
    // If not authenticated, redirect to glance
    currentView.value = 'glance';
    return null;
  }

  return (
    <div class="profile-view">
      <div class="profile-header">
        <button class="profile-back-btn" onClick={handleBack} title="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <h1 class="profile-title">Profile & Settings</h1>
      </div>

      <div class="profile-content">
        {/* Profile Card */}
        <div class="profile-card">
          <div class="profile-avatar-large">{getUserInitials()}</div>
          <div class="profile-info">
            <h2 class="profile-name">{getUserDisplayName()}</h2>
            <p class="profile-email">{getUserEmail()}</p>
          </div>
        </div>

        {/* Settings Sections */}
        <div class="profile-section">
          <h3 class="profile-section-title">Connected Services</h3>
          <div class="profile-section-content">
            <div class="profile-service-item">
              <div class="profile-service-info">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <div>
                  <div class="profile-service-name">Google Calendar</div>
                  <div class="profile-service-status">Connected</div>
                </div>
              </div>
              <span class="profile-service-badge">Active</span>
            </div>
          </div>
        </div>

        <div class="profile-section">
          <h3 class="profile-section-title">About</h3>
          <div class="profile-section-content">
            <p class="profile-about-text">
              Slate - A minimal new tab extension with tasks, notes, and calendar integration.
            </p>
            <p class="profile-about-version">Version 1.0.0</p>
          </div>
        </div>

        {/* Sign Out Button */}
        <div class="profile-actions">
          <button class="profile-signout-btn" onClick={handleSignOut}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
