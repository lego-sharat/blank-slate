import { currentView, settings } from '@/store/store';
import { useState, useEffect } from 'preact/hooks';
import type { Settings } from '@/types';
import {
  checkGmailConnection,
  initiateGmailOAuth,
  disconnectGmail,
} from '@/utils/mailSupabaseSync';

export default function SettingsView() {
  const handleBack = () => {
    currentView.value = 'glance';
  };

  // State for settings
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [linearApiKey, setLinearApiKey] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [figmaApiKey, setFigmaApiKey] = useState('');

  const [isSaved, setIsSaved] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');

  // Gmail connection state
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailLastSync, setGmailLastSync] = useState<string | undefined>();
  const [gmailConnecting, setGmailConnecting] = useState(false);

  useEffect(() => {
    // Get the Chrome extension redirect URL
    const url = chrome.runtime.getURL('auth-callback.html');
    setRedirectUrl(url);

    // Load settings from chrome.storage only
    chrome.storage.local.get('settings', (result) => {
      const storedSettings = result.settings as Partial<Settings> | undefined;
      if (storedSettings) {
        setSupabaseUrl(storedSettings.supabaseUrl || '');
        setSupabaseAnonKey(storedSettings.supabaseKey || '');
        setLinearApiKey(storedSettings.linearApiKey || '');
        setGithubToken(storedSettings.githubToken || '');
        setFigmaApiKey(storedSettings.figmaApiKey || '');
      }
    });

    // Check Gmail connection status
    checkGmailConnection().then((status) => {
      setGmailConnected(status.connected);
      setGmailLastSync(status.lastSync);
    });
  }, []);

  const handleSave = async () => {
    // Update settings signal AND save to chrome.storage
    settings.value = {
      ...settings.value,
      supabaseUrl: supabaseUrl,
      supabaseKey: supabaseAnonKey,
      linearApiKey: linearApiKey,
      githubToken: githubToken,
      figmaApiKey: figmaApiKey,
    };

    // Save settings to chrome.storage (single source of truth)
    await chrome.storage.local.set({ settings: settings.value });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);

    console.log('Settings saved to chrome.storage:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseAnonKey,
      hasLinearKey: !!linearApiKey,
      hasGithubToken: !!githubToken,
      hasFigmaApiKey: !!figmaApiKey,
    });

    // Show message
    alert('Settings saved! Reload the extension for changes to take effect.');
  };

  const handleCopyRedirectUrl = () => {
    navigator.clipboard.writeText(redirectUrl);
    alert('Redirect URL copied to clipboard!');
  };

  const handleConnectGmail = async () => {
    setGmailConnecting(true);
    try {
      const result = await initiateGmailOAuth();
      if (result.success && result.oauthUrl) {
        // Open OAuth URL in new tab
        window.open(result.oauthUrl, '_blank');
        // Poll for connection status
        const pollInterval = setInterval(async () => {
          const status = await checkGmailConnection();
          if (status.connected) {
            setGmailConnected(true);
            setGmailLastSync(status.lastSync);
            clearInterval(pollInterval);
            setGmailConnecting(false);
            alert('Gmail connected successfully!');
          }
        }, 2000);

        // Stop polling after 2 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setGmailConnecting(false);
        }, 120000);
      } else {
        alert(`Failed to connect Gmail: ${result.error || 'Unknown error'}`);
        setGmailConnecting(false);
      }
    } catch (error) {
      console.error('Error connecting Gmail:', error);
      alert('Failed to connect Gmail. Check console for details.');
      setGmailConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!confirm('Are you sure you want to disconnect Gmail? Your email history will be cleared.')) {
      return;
    }

    try {
      const result = await disconnectGmail();
      if (result.success) {
        setGmailConnected(false);
        setGmailLastSync(undefined);
        alert('Gmail disconnected successfully!');
      } else {
        alert(`Failed to disconnect Gmail: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      alert('Failed to disconnect Gmail. Check console for details.');
    }
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

        {/* Linear Configuration */}
        <div class="settings-section">
          <h3 class="settings-section-title">Linear Integration</h3>
          <div class="settings-section-description">
            Configure your Linear API key to view issues assigned to you, created by you, and mentioning you.
          </div>
          <div class="settings-section-content">
            <div class="settings-field">
              <label class="settings-label" for="linear-api-key">
                Linear API Key
              </label>
              <input
                id="linear-api-key"
                type="password"
                class="settings-input"
                placeholder="lin_api_..."
                value={linearApiKey}
                onInput={(e) => setLinearApiKey((e.target as HTMLInputElement).value)}
              />
              <div class="settings-hint">
                Create a personal API key in Linear Settings → Account → API → Personal API keys
              </div>
            </div>

            <div class="settings-info-box">
              <p>
                <strong>How to get your Linear API key:</strong>
              </p>
              <ol class="settings-instructions-sub">
                <li>Go to <a href="https://linear.app/settings/api" target="_blank" rel="noopener noreferrer">Linear Settings → API</a></li>
                <li>Click "Create key" under Personal API keys</li>
                <li>Give it a name (e.g., "Slate Extension")</li>
                <li>Copy the generated key and paste it above</li>
              </ol>
            </div>

            <button
              class="settings-save-btn"
              onClick={handleSave}
            >
              {isSaved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* GitHub Configuration */}
        <div class="settings-section">
          <h3 class="settings-section-title">GitHub Integration</h3>
          <div class="settings-section-description">
            Configure your GitHub personal access token to view pull requests created by you and assigned to you for review.
          </div>
          <div class="settings-section-content">
            <div class="settings-field">
              <label class="settings-label" for="github-token">
                GitHub Personal Access Token
              </label>
              <input
                id="github-token"
                type="password"
                class="settings-input"
                placeholder="ghp_..."
                value={githubToken}
                onInput={(e) => setGithubToken((e.target as HTMLInputElement).value)}
              />
              <div class="settings-hint">
                Create a personal access token in GitHub Settings → Developer settings → Personal access tokens
              </div>
            </div>

            <div class="settings-info-box">
              <p>
                <strong>How to create a GitHub Personal Access Token:</strong>
              </p>
              <ol class="settings-instructions-sub">
                <li>Go to <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">GitHub Settings → Personal access tokens → Tokens (classic)</a></li>
                <li>Click "Generate new token" → "Generate new token (classic)"</li>
                <li>Give it a name (e.g., "Slate Extension")</li>
                <li>Select scopes: <code>repo</code> (Full control of private repositories)</li>
                <li>Click "Generate token" and copy the generated token</li>
                <li>Paste it above (you won't be able to see it again!)</li>
              </ol>
            </div>

            <button
              class="settings-save-btn"
              onClick={handleSave}
            >
              {isSaved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Figma Configuration */}
        <div class="settings-section">
          <h3 class="settings-section-title">Figma Integration</h3>
          <div class="settings-section-description">
            Configure your Figma personal access token to automatically fetch node names and file titles for Figma URLs in your history.
          </div>
          <div class="settings-section-content">
            <div class="settings-field">
              <label class="settings-label" for="figma-api-key">
                Figma Personal Access Token
              </label>
              <input
                id="figma-api-key"
                type="password"
                class="settings-input"
                placeholder="figd_..."
                value={figmaApiKey}
                onInput={(e) => setFigmaApiKey((e.target as HTMLInputElement).value)}
              />
              <div class="settings-hint">
                Create a personal access token in Figma Settings → Account → Personal access tokens
              </div>
            </div>

            <div class="settings-info-box">
              <p>
                <strong>How to get your Figma Personal Access Token:</strong>
              </p>
              <ol class="settings-instructions-sub">
                <li>Go to <a href="https://www.figma.com/settings" target="_blank" rel="noopener noreferrer">Figma Settings → Account</a></li>
                <li>Scroll down to "Personal access tokens"</li>
                <li>Click "Create a new personal access token"</li>
                <li>Give it a name (e.g., "Slate Extension")</li>
                <li>Copy the generated token and paste it above</li>
              </ol>
              <p class="settings-note">
                <strong>Note:</strong> With this token configured, when you visit Figma URLs with node IDs, the extension will automatically fetch the node name and display it as "File Name - Node Name" in your history.
              </p>
            </div>

            <button
              class="settings-save-btn"
              onClick={handleSave}
            >
              {isSaved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Gmail Integration */}
        <div class="settings-section">
          <h3 class="settings-section-title">Gmail Integration</h3>
          <div class="settings-section-description">
            Connect your Gmail account to sync emails with AI summaries and action items. Emails are fetched server-side every 2 minutes and cached locally.
          </div>
          <div class="settings-section-content">
            <div class="settings-connection-status">
              <div class="settings-connection-indicator">
                <div class={`settings-status-dot ${gmailConnected ? 'connected' : 'disconnected'}`}></div>
                <span class="settings-status-text">
                  {gmailConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              {gmailLastSync && (
                <div class="settings-last-sync">
                  Last synced: {new Date(gmailLastSync).toLocaleString()}
                </div>
              )}
            </div>

            {!gmailConnected ? (
              <div>
                <button
                  class="settings-connect-btn"
                  onClick={handleConnectGmail}
                  disabled={gmailConnecting}
                >
                  {gmailConnecting ? 'Connecting...' : 'Connect Gmail'}
                </button>
                <div class="settings-info-box" style="margin-top: 16px;">
                  <p>
                    <strong>What happens when you connect?</strong>
                  </p>
                  <ul class="settings-instructions-sub">
                    <li>You'll authorize read-only access to your Gmail</li>
                    <li>Emails are synced server-side every 2 minutes</li>
                    <li>AI generates summaries and extracts action items</li>
                    <li>Mail filtered by onboarding/support categories</li>
                    <li>Spam, promotions, and updates are automatically excluded</li>
                  </ul>
                  <p class="settings-note">
                    <strong>Privacy:</strong> Your OAuth tokens are encrypted and stored securely in Supabase. The extension only has read-only access to your Gmail.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <button
                  class="settings-disconnect-btn"
                  onClick={handleDisconnectGmail}
                >
                  Disconnect Gmail
                </button>
                <div class="settings-info-box" style="margin-top: 16px;">
                  <p>
                    <strong>Connection Details:</strong>
                  </p>
                  <ul class="settings-instructions-sub">
                    <li>Emails are synced automatically every 2 minutes</li>
                    <li>AI summaries: Up to 100 per day (free tier)</li>
                    <li>Local cache: Last 30 days of emails (~50MB)</li>
                    <li>View your emails in the Mail tab</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Redirect URL */}
        <div class="settings-section">
          <h3 class="settings-section-title">Extension Redirect URL</h3>
          <div class="settings-section-description">
            Copy this URL and add it to Google Cloud Console as an authorized redirect URI.
          </div>
          <div class="settings-section-content">
            <div class="settings-field">
              <label class="settings-label">
                Chrome Extension Redirect URL
              </label>
              <div class="settings-url-display">
                <input
                  type="text"
                  class="settings-input"
                  value={redirectUrl}
                  readOnly
                />
                <button
                  class="settings-copy-btn"
                  onClick={handleCopyRedirectUrl}
                  title="Copy to clipboard"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
              <div class="settings-hint">
                Add this URL to Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs
              </div>
            </div>
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
              <li>
                Go to Authentication → Providers → Google and enable it
              </li>
              <li>
                In Google Cloud Console, create OAuth credentials:
                <ul class="settings-instructions-sub">
                  <li>Go to APIs & Services → Credentials</li>
                  <li>Create OAuth 2.0 Client ID (Application type: Web application)</li>
                  <li>Add TWO redirect URIs to "Authorized redirect URIs":
                    <ul class="settings-instructions-sub">
                      <li>Your Supabase callback: <code>https://[your-project].supabase.co/auth/v1/callback</code></li>
                      <li>The Chrome extension URL shown above</li>
                    </ul>
                  </li>
                  <li>Add calendar scope in OAuth consent screen: <code>https://www.googleapis.com/auth/calendar.readonly</code></li>
                </ul>
              </li>
              <li>
                Copy the OAuth Client ID and Secret to Supabase:
                <ul class="settings-instructions-sub">
                  <li>In Supabase, go to Authentication → Providers → Google</li>
                  <li>Paste your Client ID and Client Secret</li>
                  <li>Save the provider settings</li>
                </ul>
              </li>
              <li>Copy your Supabase project URL and anon key from Settings → API</li>
              <li>Paste the credentials in the fields above and save</li>
              <li>Refresh the page and sign in with Google</li>
            </ol>
          </div>
        </div>

        {/* About */}
        <div class="settings-section">
          <h3 class="settings-section-title">About</h3>
          <div class="settings-section-content">
            <p class="settings-about-text">
              Slate - A minimal new tab extension with tasks, thoughts, and calendar integration.
            </p>
            <p class="settings-about-version">Version 1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
