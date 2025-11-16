# Minimal New Tab Extension

A minimal, greyscale Chrome extension that replaces your new tab page with a clean interface for todos and notes with Notion integration.

## Features

- **Supabase Authentication**: Secure user authentication with automatic token refresh
- **Todo List**: Add, check off, and delete tasks
- **Google Calendar Integration**: View today's calendar events
- **Notes System**:
  - Full-screen modal editor for rich note-taking
  - Title and content fields for organized notes
  - Markdown support with live preview
  - List view with note titles and previews
  - Click any note to edit
- **Notion Integration**:
  - Export notes directly to Notion
  - Secure storage of API credentials in Supabase
  - One-click export per note
- **Minimal Design**: Greyscale color scheme with monospace or handwriting fonts
- **Persistent Storage**: All data saved securely with Supabase + localStorage
- **Modern UX**: Smooth transitions and modal-based editing

## Installation

### For Development

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" in the top right
6. Click "Load unpacked"
7. Select this directory

## Usage

### Todos
- **Add Todo**: Type in the input field and press Enter or click the + button
- **Complete Todo**: Click the checkbox next to a task
- **Delete Todo**: Hover over a task and click the DEL button

### Notes
- **Create Note**: Click the "+ NEW NOTE" button
- **Edit Note**: Click on any existing note in the list
- **Save Note**: Click "Save" button or press Escape to cancel
- **Markdown Preview**: Click "Preview" to see formatted markdown
- **Delete Note**: Click "Delete Note" button when editing
- **Export to Notion**: Click the ↗ button on any note

### Supabase Setup (One-Time Configuration)

**Important**: This extension uses Supabase for authentication with Google Sign-In.

#### Step 1: Create Supabase Project

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Project Settings → API
4. Copy your **Project URL** and **Anon/Public Key**

#### Step 2: Enable Google OAuth in Supabase

1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** in the providers list
3. Enable it and configure:
   - **Authorized Client IDs**: Add your Google OAuth client ID
   - **Authorized redirect URLs**: Add `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Follow [Supabase's Google OAuth guide](https://supabase.com/docs/guides/auth/social-login/auth-google) to:
   - Create a Google Cloud project
   - Enable Google Calendar API
   - Create OAuth credentials
   - Add authorized redirect URIs

#### Step 3: Configure Extension

1. Open the extension and click the ⚙ (Settings) button
2. Paste your Supabase URL and Anon Key
3. Click "Save Settings"
4. Click "Sign in with Google"
5. Authorize both authentication and calendar access

**Benefits**:
- **One-step authentication**: Sign in with Google and get calendar access simultaneously
- **Automatic token refresh**: Google Calendar tokens refresh automatically (see Token Refresh Setup below)
- **Secure storage**: Credentials stored securely in Supabase
- **Cross-device sync**: Access your settings from anywhere

#### Optional: Token Refresh Setup (Recommended)

For uninterrupted calendar access, deploy the token refresh edge function using the automated deployment script:

**Quick Setup (5 minutes):**
```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login to Supabase
supabase login

# 3. Configure environment
cp .env.example .env
# Edit .env and fill in your values

# 4. Deploy
npm run deploy-edge-function
```

**Without this setup**: The extension will work but may prompt you to sign in again after ~1 hour when tokens expire.

**With this setup**: Tokens refresh automatically in the background without user intervention.

📖 **Detailed guide**: See [EDGE_FUNCTION_SETUP.md](EDGE_FUNCTION_SETUP.md) for step-by-step instructions and troubleshooting.

### Notion Integration Setup

1. Create a Notion integration at [Notion Developers](https://developers.notion.com/docs/create-a-notion-integration)
2. Copy your integration's API key
3. Create a database in Notion and copy its ID from the URL
4. Open Settings and paste both values
5. Click "Save Settings"

**Note**: With Supabase authentication, your credentials are securely stored and synced across devices.

### Keyboard Shortcuts
- **ESC**: Close any open modal
- **Enter**: Add new todo (when focused on todo input)

## Data Storage

Data storage uses a hybrid approach:
- **Local Storage**: Todos, notes, and cached calendar events are stored in browser localStorage
- **Supabase**: User authentication sessions and Notion credentials are stored securely in Supabase user metadata
- **OAuth**: Google Calendar access tokens are managed with automatic refresh (requires edge function setup)

## Privacy

- Notes and todos are stored locally in your browser
- Notion credentials are stored securely in Supabase user metadata (encrypted)
- Google Calendar tokens are managed with automatic refresh (via optional edge function)
- Supabase handles authentication with industry-standard security
- No analytics or tracking
- External API calls are only made when:
  - Authenticating with Google via Supabase
  - Refreshing expired tokens (if edge function is deployed)
  - Fetching Google Calendar events
  - Explicitly exporting to Notion

## Development

### Building

```bash
npm run build
```

This uses esbuild to bundle the Supabase client and your code into a single script.js file.

### File Structure

- `src/script.js` - Main application logic
- `src/supabase.js` - Supabase authentication and token refresh functions
- `build.js` - Build script using esbuild
- `newtab.html` - Extension UI
- `styles.css` - Styling
- `manifest.json` - Chrome extension manifest
- `supabase/functions/refresh-google-token/` - Edge function for automatic token refresh
