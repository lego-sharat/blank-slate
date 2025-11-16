import { currentView } from '@/store/store';
import { useState } from 'preact/hooks';

export default function SettingsView() {
  const handleBack = () => {
    currentView.value = 'glance';
  };

  // Get current values from localStorage
  const [supabaseUrl, setSupabaseUrl] = useState(
    localStorage.getItem('supabase_url') || ''
  );
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    localStorage.getItem('supabase_anon_key') || ''
  );

  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('supabase_url', supabaseUrl);
    localStorage.setItem('supabase_anon_key', supabaseAnonKey);

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);

    // Show message
    alert('Settings saved! Please refresh the page for changes to take effect.');
  };

  return (
    <div class="settings-view">
      <div class="settings-header">
        <button class="settings-back-btn" onClick={handleBack} title="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <h1 class="settings-title">Settings</h1>
      </div>

      <div class="settings-content">
        {/* Supabase Configuration */}
        <div class="settings-section">
          <h3 class="settings-section-title">Supabase Configuration</h3>
          <div class="settings-section-description">
            Configure your Supabase project credentials for authentication and calendar sync.
          </div>
          <div class="settings-section-content">
            <div class="settings-field">
              <label class="settings-label" for="supabase-url">
                Supabase Project URL
              </label>
              <input
                id="supabase-url"
                type="text"
                class="settings-input"
                placeholder="https://your-project.supabase.co"
                value={supabaseUrl}
                onInput={(e) => setSupabaseUrl((e.target as HTMLInputElement).value)}
              />
              <div class="settings-hint">
                Found in your Supabase project settings under "API" → "Project URL"
              </div>
            </div>

            <div class="settings-field">
              <label class="settings-label" for="supabase-anon-key">
                Supabase Anon Key
              </label>
              <input
                id="supabase-anon-key"
                type="password"
                class="settings-input"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseAnonKey}
                onInput={(e) => setSupabaseAnonKey((e.target as HTMLInputElement).value)}
              />
              <div class="settings-hint">
                Found in your Supabase project settings under "API" → "Project API keys" → "anon public"
              </div>
            </div>

            <button
              class="settings-save-btn"
              onClick={handleSave}
            >
              {isSaved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div class="settings-section">
          <h3 class="settings-section-title">Setup Instructions</h3>
          <div class="settings-section-content">
            <ol class="settings-instructions">
              <li>
                Create a Supabase project at{' '}
                <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">
                  supabase.com
                </a>
              </li>
              <li>Enable Google OAuth provider in Authentication → Providers</li>
              <li>Add calendar scope: <code>https://www.googleapis.com/auth/calendar.readonly</code></li>
              <li>Copy your project URL and anon key from Settings → API</li>
              <li>Paste the credentials above and save</li>
              <li>Refresh the page and sign in with Google</li>
            </ol>
          </div>
        </div>

        {/* About */}
        <div class="settings-section">
          <h3 class="settings-section-title">About</h3>
          <div class="settings-section-content">
            <p class="settings-about-text">
              Slate - A minimal new tab extension with tasks, notes, and calendar integration.
            </p>
            <p class="settings-about-version">Version 1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
