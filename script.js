// Storage keys
const TODOS_KEY = 'minimal_newtab_todos';
const NOTES_KEY = 'minimal_newtab_notes';
const SETTINGS_KEY = 'minimal_newtab_settings';

// State
let todos = [];
let notes = [];
let settings = { notionApiKey: '', notionDatabaseId: '' };
let currentNoteId = null;
let isPreviewMode = false;

// DOM elements - Todos
const todoInput = document.getElementById('todoInput');
const addTodoBtn = document.getElementById('addTodoBtn');
const todoList = document.getElementById('todoList');

// DOM elements - Notes
const addNoteBtn = document.getElementById('addNoteBtn');
const notesList = document.getElementById('notesList');
const noteModal = document.getElementById('noteModal');
const noteTitleInput = document.getElementById('noteTitleInput');
const noteContentInput = document.getElementById('noteContentInput');
const notePreview = document.getElementById('notePreview');
const previewToggle = document.getElementById('previewToggle');
const copyMarkdown = document.getElementById('copyMarkdown');
const exportToNotion = document.getElementById('exportToNotion');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');
const cancelBtn = document.getElementById('cancelBtn');
const closeModal = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');

// DOM elements - Settings
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const saveSettings = document.getElementById('saveSettings');
const notionApiKey = document.getElementById('notionApiKey');
const notionDatabaseId = document.getElementById('notionDatabaseId');

// DOM elements - Clock
const timeDisplay = document.getElementById('timeDisplay');
const dateDisplay = document.getElementById('dateDisplay');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadTodos();
  loadNotes();
  loadSettings();
  setupEventListeners();
  updateClock();
  setInterval(updateClock, 1000);
});

// Setup event listeners
function setupEventListeners() {
  // Todos
  addTodoBtn.addEventListener('click', addTodo);
  todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addTodo();
    }
  });

  // Notes
  addNoteBtn.addEventListener('click', () => openNoteModal());
  saveNoteBtn.addEventListener('click', saveNote);
  deleteNoteBtn.addEventListener('click', confirmDeleteNote);
  cancelBtn.addEventListener('click', closeNoteModal);
  closeModal.addEventListener('click', closeNoteModal);
  previewToggle.addEventListener('click', togglePreview);
  copyMarkdown.addEventListener('click', copyCurrentNoteToClipboard);
  exportToNotion.addEventListener('click', exportCurrentNoteToNotion);

  // Settings
  settingsBtn.addEventListener('click', openSettingsModal);
  closeSettings.addEventListener('click', closeSettingsModal);
  saveSettings.addEventListener('click', saveSettingsData);

  // Modal backdrop click
  noteModal.addEventListener('click', (e) => {
    if (e.target === noteModal) {
      closeNoteModal();
    }
  });
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeSettingsModal();
    }
  });

  // ESC key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (noteModal.classList.contains('show')) {
        closeNoteModal();
      }
      if (settingsModal.classList.contains('show')) {
        closeSettingsModal();
      }
    }
  });

  // Auto-update preview when typing
  noteContentInput.addEventListener('input', () => {
    if (isPreviewMode) {
      updatePreview();
    }
  });
}

// Todo functions
function loadTodos() {
  const stored = localStorage.getItem(TODOS_KEY);
  if (stored) {
    todos = JSON.parse(stored);
    renderTodos();
  }
}

function saveTodos() {
  localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
}

function addTodo() {
  const text = todoInput.value.trim();
  if (text === '') return;

  const todo = {
    id: Date.now(),
    text: text,
    completed: false
  };

  todos.push(todo);
  saveTodos();
  renderTodos();
  todoInput.value = '';
  todoInput.focus();
}

function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    saveTodos();
    renderTodos();
  }
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  saveTodos();
  renderTodos();
}

function renderTodos() {
  todoList.innerHTML = '';

  todos.forEach(todo => {
    const li = document.createElement('li');
    li.className = `todo-item${todo.completed ? ' completed' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => toggleTodo(todo.id));

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'todo-delete';
    deleteBtn.textContent = 'DEL';
    deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

    li.appendChild(checkbox);
    li.appendChild(text);
    li.appendChild(deleteBtn);
    todoList.appendChild(li);
  });
}

// Notes functions
function loadNotes() {
  const stored = localStorage.getItem(NOTES_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Migrate old format if needed
        notes = parsed.map(note => {
          if (!note.title && note.text) {
            return {
              id: note.id,
              title: note.text.substring(0, 50),
              content: note.text,
              createdAt: note.createdAt
            };
          }
          return note;
        });
      } else {
        notes = [];
      }
    } catch (e) {
      if (stored.trim() !== '') {
        notes = [{
          id: Date.now(),
          title: 'Migrated Note',
          content: stored,
          createdAt: Date.now()
        }];
        saveNotesData();
      } else {
        notes = [];
      }
    }
    renderNotes();
  }
}

function saveNotesData() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function openNoteModal(noteId = null) {
  currentNoteId = noteId;
  isPreviewMode = false;

  if (noteId) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      modalTitle.textContent = 'Edit Note';
      noteTitleInput.value = note.title || '';
      noteContentInput.value = note.content || '';
      deleteNoteBtn.classList.remove('hidden');
    }
  } else {
    modalTitle.textContent = 'New Note';
    noteTitleInput.value = '';
    noteContentInput.value = '';
    deleteNoteBtn.classList.add('hidden');
  }

  noteContentInput.classList.remove('hidden');
  notePreview.classList.add('hidden');
  previewToggle.textContent = 'Preview';

  noteModal.classList.add('show');
  setTimeout(() => noteTitleInput.focus(), 100);
}

function closeNoteModal() {
  noteModal.classList.remove('show');
  currentNoteId = null;
  isPreviewMode = false;
}

function saveNote() {
  const title = noteTitleInput.value.trim();
  const content = noteContentInput.value.trim();

  if (title === '' && content === '') return;

  if (currentNoteId) {
    const note = notes.find(n => n.id === currentNoteId);
    if (note) {
      note.title = title || 'Untitled';
      note.content = content;
      note.updatedAt = Date.now();
    }
  } else {
    const note = {
      id: Date.now(),
      title: title || 'Untitled',
      content: content,
      createdAt: Date.now()
    };
    notes.unshift(note);
  }

  saveNotesData();
  renderNotes();
  closeNoteModal();
}

function confirmDeleteNote() {
  if (!currentNoteId) return;

  if (confirm('Are you sure you want to delete this note?')) {
    notes = notes.filter(n => n.id !== currentNoteId);
    saveNotesData();
    renderNotes();
    closeNoteModal();
  }
}

function togglePreview() {
  isPreviewMode = !isPreviewMode;

  if (isPreviewMode) {
    updatePreview();
    noteContentInput.classList.add('hidden');
    notePreview.classList.remove('hidden');
    previewToggle.textContent = 'Edit';
  } else {
    noteContentInput.classList.remove('hidden');
    notePreview.classList.add('hidden');
    previewToggle.textContent = 'Preview';
  }
}

function updatePreview() {
  const content = noteContentInput.value;
  notePreview.innerHTML = marked.parse(content);
}

async function copyNoteToClipboard(noteId) {
  const note = notes.find(n => n.id === noteId);
  if (!note) return;

  const markdown = `# ${note.title || 'Untitled'}\n\n${note.content || ''}`;

  try {
    await navigator.clipboard.writeText(markdown);
    showCopyFeedback('Copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy:', err);
    showCopyFeedback('Failed to copy', true);
  }
}

async function copyCurrentNoteToClipboard() {
  const title = noteTitleInput.value.trim() || 'Untitled';
  const content = noteContentInput.value.trim();
  const markdown = `# ${title}\n\n${content}`;

  try {
    await navigator.clipboard.writeText(markdown);
    showCopyFeedback('Copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy:', err);
    showCopyFeedback('Failed to copy', true);
  }
}

function showCopyFeedback(message, isError = false) {
  const originalText = copyMarkdown.textContent;
  copyMarkdown.textContent = message;
  copyMarkdown.style.backgroundColor = isError ? '#c04040' : '#4a4a4a';
  copyMarkdown.style.color = '#fff';

  setTimeout(() => {
    copyMarkdown.textContent = originalText;
    copyMarkdown.style.backgroundColor = '';
    copyMarkdown.style.color = '';
  }, 2000);
}

function renderNotes() {
  notesList.innerHTML = '';

  if (notes.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'empty-message';
    emptyMsg.textContent = 'No notes yet. Click "+ NEW NOTE" to create one.';
    notesList.appendChild(emptyMsg);
    return;
  }

  notes.forEach(note => {
    const li = document.createElement('li');
    li.className = 'note-item';

    const content = document.createElement('div');
    content.className = 'note-content';

    const title = document.createElement('div');
    title.className = 'note-title';
    title.textContent = note.title || 'Untitled';

    const preview = document.createElement('div');
    preview.className = 'note-preview-text';
    const previewText = note.content ? note.content.substring(0, 100) : '';
    preview.textContent = previewText + (note.content && note.content.length > 100 ? '...' : '');

    content.appendChild(title);
    content.appendChild(preview);
    content.addEventListener('click', () => openNoteModal(note.id));

    const actions = document.createElement('div');
    actions.className = 'note-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'note-action-btn';
    copyBtn.textContent = '📋';
    copyBtn.title = 'Copy as Markdown';
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await copyNoteToClipboard(note.id);
      // Visual feedback
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✓';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1500);
    });

    const exportBtn = document.createElement('button');
    exportBtn.className = 'note-action-btn';
    exportBtn.textContent = '↗';
    exportBtn.title = 'Export to Notion';
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportNoteToNotion(note.id);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'note-action-btn';
    deleteBtn.textContent = 'DEL';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Delete this note?')) {
        notes = notes.filter(n => n.id !== note.id);
        saveNotesData();
        renderNotes();
      }
    });

    actions.appendChild(copyBtn);
    actions.appendChild(exportBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(content);
    li.appendChild(actions);
    notesList.appendChild(li);
  });
}

// Settings functions
function loadSettings() {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    try {
      settings = JSON.parse(stored);
    } catch (e) {
      settings = { notionApiKey: '', notionDatabaseId: '' };
    }
  }
}

function openSettingsModal() {
  notionApiKey.value = settings.notionApiKey || '';
  notionDatabaseId.value = settings.notionDatabaseId || '';
  settingsModal.classList.add('show');
}

function closeSettingsModal() {
  settingsModal.classList.remove('show');
}

function saveSettingsData() {
  settings.notionApiKey = notionApiKey.value.trim();
  settings.notionDatabaseId = notionDatabaseId.value.trim();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  closeSettingsModal();
  alert('Settings saved!');
}

// Notion Integration
async function exportNoteToNotion(noteId) {
  if (!settings.notionApiKey || !settings.notionDatabaseId) {
    alert('Please configure Notion API settings first (click the ⚙ icon)');
    openSettingsModal();
    return;
  }

  const note = notes.find(n => n.id === noteId);
  if (!note) return;

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.notionApiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: settings.notionDatabaseId },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: note.title || 'Untitled'
                }
              }
            ]
          }
        },
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: note.content || ''
                  }
                }
              ]
            }
          }
        ]
      })
    });

    if (response.ok) {
      alert('Note exported to Notion successfully!');
    } else {
      const error = await response.json();
      console.error('Notion API error:', error);
      alert(`Failed to export to Notion: ${error.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export to Notion. Check your API settings and try again.');
  }
}

async function exportCurrentNoteToNotion() {
  if (!currentNoteId) {
    alert('Please save the note first before exporting to Notion.');
    return;
  }
  await exportNoteToNotion(currentNoteId);
}

// Clock functions
function updateClock() {
  const now = new Date();

  // Format time
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  timeDisplay.textContent = `${hours}:${minutes}:${seconds}`;

  // Format date
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayName = days[now.getDay()];
  const monthName = months[now.getMonth()];
  const date = now.getDate();
  const year = now.getFullYear();

  dateDisplay.textContent = `${dayName}, ${monthName} ${date}, ${year}`;
}
