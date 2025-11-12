// Storage keys
const TODOS_KEY = 'minimal_newtab_todos';
const NOTES_KEY = 'minimal_newtab_notes';
const SETTINGS_KEY = 'minimal_newtab_settings';

// State
let todos = [];
let notes = [];
let settings = { notionApiKey: '', notionDatabaseId: '' };
let currentNoteId = null;
let currentView = 'todo'; // 'todo' or 'note'
let isPreviewMode = false;

// DOM elements - Sidebar
const sidebarList = document.getElementById('sidebarList');
const addNoteBtn = document.getElementById('addNoteBtn');

// DOM elements - Views
const todoView = document.getElementById('todoView');
const noteView = document.getElementById('noteView');
const welcomeView = document.getElementById('welcomeView');

// DOM elements - Todos
const todoInput = document.getElementById('todoInput');
const addTodoBtn = document.getElementById('addTodoBtn');
const todoList = document.getElementById('todoList');

// DOM elements - Notes
const noteViewTitle = document.getElementById('noteViewTitle');
const noteTitleInput = document.getElementById('noteTitleInput');
const noteContentInput = document.getElementById('noteContentInput');
const notePreview = document.getElementById('notePreview');
const previewToggle = document.getElementById('previewToggle');
const copyMarkdown = document.getElementById('copyMarkdown');
const exportToNotion = document.getElementById('exportToNotion');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');

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
  renderSidebar();
  showView('todo');
});

// Setup event listeners
function setupEventListeners() {
  // Sidebar
  addNoteBtn.addEventListener('click', () => createNewNote());

  // Todos
  addTodoBtn.addEventListener('click', addTodo);
  todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addTodo();
    }
  });

  // Notes
  saveNoteBtn.addEventListener('click', saveNote);
  deleteNoteBtn.addEventListener('click', confirmDeleteNote);
  previewToggle.addEventListener('click', togglePreview);
  copyMarkdown.addEventListener('click', copyCurrentNoteToClipboard);
  exportToNotion.addEventListener('click', exportCurrentNoteToNotion);

  // Settings
  settingsBtn.addEventListener('click', openSettingsModal);
  closeSettings.addEventListener('click', closeSettingsModal);
  saveSettings.addEventListener('click', saveSettingsData);

  // Modal backdrop click
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeSettingsModal();
    }
  });

  // ESC key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
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

  // Auto-save on note title/content change
  noteTitleInput.addEventListener('input', () => {
    if (currentNoteId && currentView === 'note') {
      autoSaveNote();
    }
  });

  noteContentInput.addEventListener('input', () => {
    if (currentNoteId && currentView === 'note') {
      autoSaveNote();
    }
  });
}

// Sidebar functions
function renderSidebar() {
  sidebarList.innerHTML = '';

  // Add TODO item first (special item)
  const todoItem = document.createElement('li');
  todoItem.className = `sidebar-item${currentView === 'todo' ? ' active' : ''}`;
  todoItem.innerHTML = `
    <div class="sidebar-item-content">
      <div class="sidebar-item-title">TODO</div>
      <div class="sidebar-item-preview">${todos.length} task${todos.length !== 1 ? 's' : ''}</div>
    </div>
  `;
  todoItem.addEventListener('click', () => showTodoView());
  sidebarList.appendChild(todoItem);

  // Add notes
  notes.forEach(note => {
    const li = document.createElement('li');
    li.className = `sidebar-item${currentView === 'note' && currentNoteId === note.id ? ' active' : ''}`;

    const previewText = note.content ? note.content.substring(0, 50) : '';
    li.innerHTML = `
      <div class="sidebar-item-content">
        <div class="sidebar-item-title">${note.title || 'Untitled'}</div>
        <div class="sidebar-item-preview">${previewText}${note.content && note.content.length > 50 ? '...' : ''}</div>
      </div>
    `;
    li.addEventListener('click', () => showNoteView(note.id));
    sidebarList.appendChild(li);
  });

  // Show message if no notes
  if (notes.length === 0) {
    const emptyMsg = document.createElement('li');
    emptyMsg.className = 'sidebar-item';
    emptyMsg.style.cursor = 'default';
    emptyMsg.style.opacity = '0.6';
    emptyMsg.innerHTML = `
      <div class="sidebar-item-content">
        <div class="sidebar-item-preview" style="text-align: center;">No notes yet. Click + to create one.</div>
      </div>
    `;
    sidebarList.appendChild(emptyMsg);
  }
}

// View switching functions
function showView(view) {
  // Hide all views
  todoView.classList.add('hidden');
  noteView.classList.add('hidden');
  welcomeView.classList.add('hidden');

  // Show selected view
  if (view === 'todo') {
    todoView.classList.remove('hidden');
  } else if (view === 'note') {
    noteView.classList.remove('hidden');
  } else {
    welcomeView.classList.remove('hidden');
  }

  currentView = view;
  renderSidebar();
}

function showTodoView() {
  showView('todo');
  currentNoteId = null;
}

function showNoteView(noteId) {
  const note = notes.find(n => n.id === noteId);
  if (!note) return;

  currentNoteId = noteId;
  isPreviewMode = false;

  noteViewTitle.textContent = note.title || 'Note';
  noteTitleInput.value = note.title || '';
  noteContentInput.value = note.content || '';

  noteContentInput.classList.remove('hidden');
  notePreview.classList.add('hidden');
  previewToggle.textContent = 'Preview';

  deleteNoteBtn.classList.remove('hidden');

  showView('note');
  setTimeout(() => noteTitleInput.focus(), 100);
}

function createNewNote() {
  const note = {
    id: Date.now(),
    title: 'Untitled',
    content: '',
    createdAt: Date.now()
  };
  notes.unshift(note);
  saveNotesData();
  renderSidebar();
  showNoteView(note.id);
}

// Auto-save functionality
let autoSaveTimeout = null;
function autoSaveNote() {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }

  autoSaveTimeout = setTimeout(() => {
    if (currentNoteId) {
      const note = notes.find(n => n.id === currentNoteId);
      if (note) {
        note.title = noteTitleInput.value.trim() || 'Untitled';
        note.content = noteContentInput.value.trim();
        note.updatedAt = Date.now();
        saveNotesData();
        renderSidebar(); // Update sidebar preview
      }
    }
  }, 500); // Auto-save after 500ms of no typing
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
  renderSidebar(); // Update TODO count in sidebar
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

  if (todos.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.style.color = '#909090';
    emptyMsg.style.fontSize = '14px';
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.padding = '40px 20px';
    emptyMsg.textContent = 'No tasks yet. Add one above!';
    todoList.appendChild(emptyMsg);
    return;
  }

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
    renderSidebar();
  }
}

function saveNotesData() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function saveNote() {
  if (!currentNoteId) return;

  const note = notes.find(n => n.id === currentNoteId);
  if (note) {
    note.title = noteTitleInput.value.trim() || 'Untitled';
    note.content = noteContentInput.value.trim();
    note.updatedAt = Date.now();
    saveNotesData();
    renderSidebar();
  }

  // Show feedback
  const originalText = saveNoteBtn.textContent;
  saveNoteBtn.textContent = 'Saved!';
  saveNoteBtn.style.backgroundColor = '#4a4a4a';
  setTimeout(() => {
    saveNoteBtn.textContent = originalText;
    saveNoteBtn.style.backgroundColor = '';
  }, 1500);
}

function confirmDeleteNote() {
  if (!currentNoteId) return;

  if (confirm('Are you sure you want to delete this note?')) {
    notes = notes.filter(n => n.id !== currentNoteId);
    saveNotesData();
    renderSidebar();

    // Show TODO view after deleting
    showTodoView();
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

async function copyCurrentNoteToClipboard() {
  const title = noteTitleInput.value.trim() || 'Untitled';
  const content = noteContentInput.value.trim();
  const markdown = `# ${title}\n\n${content}`;

  try {
    await navigator.clipboard.writeText(markdown);
    showCopyFeedback('Copied!');
  } catch (err) {
    console.error('Failed to copy:', err);
    showCopyFeedback('Failed', true);
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
async function exportCurrentNoteToNotion() {
  if (!currentNoteId) {
    alert('Please select a note first before exporting to Notion.');
    return;
  }

  if (!settings.notionApiKey || !settings.notionDatabaseId) {
    alert('Please configure Notion API settings first (click the ⚙ icon)');
    openSettingsModal();
    return;
  }

  const note = notes.find(n => n.id === currentNoteId);
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
