# Minimal New Tab Extension

A minimal, greyscale Chrome extension that replaces your new tab page with a clean interface for todos and notes with Notion integration.

## Features

- **Todo List**: Add, check off, and delete tasks
- **Notes System**:
  - Full-screen modal editor for rich note-taking
  - Title and content fields for organized notes
  - Markdown support with live preview
  - List view with note titles and previews
  - Click any note to edit
- **Notion Integration**:
  - Export notes directly to Notion
  - Secure local storage of API credentials
  - One-click export per note
- **Minimal Design**: Greyscale color scheme with monospace font
- **Persistent Storage**: All data saved locally using localStorage
- **Modern UX**: Smooth transitions and modal-based editing

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select this directory

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

### Notion Integration Setup

1. Click the ⚙ (settings) icon in the top-right corner
2. Create a Notion integration at [Notion Developers](https://developers.notion.com/docs/create-a-notion-integration)
3. Copy your integration's API key
4. Create a database in Notion and copy its ID from the URL
5. Paste both values in the settings modal
6. Click "Save Settings"

**Note**: Your API key is stored locally in your browser and never sent anywhere except to Notion.

### Keyboard Shortcuts
- **ESC**: Close any open modal
- **Enter**: Add new todo (when focused on todo input)

## Data Storage

All data is stored locally using browser localStorage:
- Todos persist across sessions
- Notes persist across sessions
- Settings (Notion API key) persist locally
- No data is sent to external servers except when explicitly exporting to Notion

## Privacy

- All notes and todos are stored locally in your browser
- Notion API credentials are stored locally and only used for your explicit export actions
- No analytics or tracking
- No external dependencies (uses lightweight built-in markdown parser)
- Notion API is only contacted when you explicitly export a note
