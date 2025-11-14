// Import Supabase functions
import {
  initSupabase,
  getSupabase,
  signInWithGoogle,
  signOut,
  getCurrentUser,
  getSession,
  getGoogleAccessToken,
  updateUserData,
  getUserData
} from './supabase.js';

// Storage keys
const TODOS_KEY = 'minimal_newtab_todos';
const NOTES_KEY = 'minimal_newtab_notes';
const SETTINGS_KEY = 'minimal_newtab_settings';
const CALENDAR_TOKEN_KEY = 'minimal_newtab_calendar_token';
const CALENDAR_EVENTS_KEY = 'minimal_newtab_calendar_events';

// State
let todos = [];
let notes = [];
let settings = {
  notionApiKey: '',
  notionDatabaseId: '',
  fontStyle: 'mono',
  googleClientId: '',
  supabaseUrl: '',
  supabaseKey: ''
};
let currentNoteId = null;
let currentView = 'planner'; // 'planner' or 'note'
let isPreviewMode = false;
let copyButtonTimeout = null;
let calendarEvents = [];
let calendarToken = null;
let isCalendarConnected = false;
let calendarFetchInterval = null;
let currentUser = null;
let isSupabaseInitialized = false;

// DOM elements - Sidebar
const sidebar = document.querySelector('.sidebar');
const sidebarList = document.getElementById('sidebarList');
const addNoteBtn = document.getElementById('addNoteBtn');
const collapseSidebarBtn = document.getElementById('collapseSidebarBtn');
const searchNotesBtn = document.getElementById('searchNotesBtn');

// DOM elements - Search Modal
const searchModal = document.getElementById('searchModal');
const searchModalInput = document.getElementById('searchModalInput');
const searchResults = document.getElementById('searchResults');

// DOM elements - Views
const plannerView = document.getElementById('plannerView');
const noteView = document.getElementById('noteView');
const welcomeView = document.getElementById('welcomeView');

// DOM elements - Planner View
const plannerTodoInput = document.getElementById('plannerTodoInput');
const addPlannerTodoBtn = document.getElementById('addPlannerTodoBtn');
const plannerTodoList = document.getElementById('plannerTodoList');
const plannerTodoInputActions = document.getElementById('plannerTodoInputActions');
const saveAddPlannerTodoBtn = document.getElementById('saveAddPlannerTodoBtn');
const cancelAddPlannerTodoBtn = document.getElementById('cancelAddPlannerTodoBtn');
const connectCalendar = document.getElementById('connectCalendar');
const refreshCalendar = document.getElementById('refreshCalendar');
const calendarStatus = document.getElementById('calendarStatus');
const calendarEventsList = document.getElementById('calendarEventsList');

// DOM elements - Notes
const noteTitleInput = document.getElementById('noteTitleInput');
const noteContentInput = document.getElementById('noteContentInput');
const notePreview = document.getElementById('notePreview');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');
const copyMarkdown = document.getElementById('copyMarkdown');
const togglePreview = document.getElementById('togglePreview');
const exportToNotion = document.getElementById('exportToNotion');

// DOM elements - Settings
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const saveSettings = document.getElementById('saveSettings');
const fontStyle = document.getElementById('fontStyle');
const googleClientId = document.getElementById('googleClientId');
const notionApiKey = document.getElementById('notionApiKey');
const notionDatabaseId = document.getElementById('notionDatabaseId');

// DOM elements - Authentication
const supabaseUrl = document.getElementById('supabaseUrl');
const supabaseKey = document.getElementById('supabaseKey');
const authStatus = document.getElementById('authStatus');
const authContainer = document.getElementById('authContainer');
const signInWithGoogleBtn = document.getElementById('signInWithGoogleBtn');
const signOutBtn = document.getElementById('signOutBtn');

// DOM elements - Clock
const timeDisplay = document.getElementById('timeDisplay');
const dateDisplay = document.getElementById('dateDisplay');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  loadTodos();
  loadNotes();
  loadSettings();
  await initializeSupabase();
  await checkAuthStatus();
  loadCalendarToken();
  loadCachedCalendarEvents();
  setupEventListeners();
  updateClock();
  setInterval(updateClock, 1000);
  renderSidebar();
  showPlannerView();
  startCalendarBackgroundFetch();
});

// Setup event listeners
function setupEventListeners() {
  // Sidebar
  collapseSidebarBtn.addEventListener('click', toggleSidebar);
  addNoteBtn.addEventListener('click', () => createNewNote());
  searchNotesBtn.addEventListener('click', openSearchModal);

  // Search Modal
  searchModalInput.addEventListener('input', handleSearchModalInput);
  searchModal.querySelector('.search-modal-backdrop').addEventListener('click', closeSearchModal);

  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // ESC to close search modal
    if (e.key === 'Escape' && !searchModal.classList.contains('hidden')) {
      closeSearchModal();
    }
    // Cmd/Ctrl+K to open search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openSearchModal();
    }
  });

  // Planner View Todos
  addPlannerTodoBtn.addEventListener('click', addTodo);
  saveAddPlannerTodoBtn.addEventListener('click', addTodo);
  cancelAddPlannerTodoBtn.addEventListener('click', cancelAddPlannerTodo);

  plannerTodoInput.addEventListener('focus', () => {
    showAddPlannerTodoActions();
  });

  plannerTodoInput.addEventListener('blur', () => {
    setTimeout(() => {
      hideAddPlannerTodoActions();
    }, 150);
  });

  plannerTodoInput.addEventListener('input', () => {
    if (plannerTodoInput.value.trim() !== '') {
      showAddPlannerTodoActions();
    }
  });

  plannerTodoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addTodo();
    }
  });

  plannerTodoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cancelAddPlannerTodo();
    }
  });

  // Calendar
  connectCalendar.addEventListener('click', connectGoogleCalendar);
  refreshCalendar.addEventListener('click', () => fetchCalendarEvents(true));

  // Notes
  deleteNoteBtn.addEventListener('click', confirmDeleteNote);
  copyMarkdown.addEventListener('click', copyCurrentNoteToClipboard);
  togglePreview.addEventListener('click', togglePreviewMode);
  exportToNotion.addEventListener('click', exportCurrentNoteToNotion);

  // Settings
  settingsBtn.addEventListener('click', openSettingsModal);
  closeSettings.addEventListener('click', closeSettingsModal);
  saveSettings.addEventListener('click', saveSettingsData);

  // Authentication
  signInWithGoogleBtn.addEventListener('click', handleSignInWithGoogle);
  signOutBtn.addEventListener('click', handleSignOut);
  supabaseUrl.addEventListener('input', handleSupabaseConfigChange);
  supabaseKey.addEventListener('input', handleSupabaseConfigChange);

  // Listen for auth state changes
  window.addEventListener('supabase-auth-changed', handleAuthStateChange);

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

  // Enter key to focus on planner input when on planner page
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && currentView === 'planner') {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement.tagName === 'INPUT' ||
                            activeElement.tagName === 'TEXTAREA' ||
                            activeElement.tagName === 'BUTTON';

      if (!isInputFocused) {
        e.preventDefault();
        plannerTodoInput.focus();
      }
    }
  });

  // Auto-save on note title/content change
  noteTitleInput.addEventListener('input', () => {
    autoResizeTitle();
    if (currentNoteId && currentView === 'note') {
      autoSaveNote();
    }
  });

  noteContentInput.addEventListener('input', () => {
    autoResizeContent();
    if (currentNoteId && currentView === 'note') {
      autoSaveNote();
    }
  });
}

// Sidebar functions
function toggleSidebar() {
  sidebar.classList.toggle('collapsed');
  const isCollapsed = sidebar.classList.contains('collapsed');
  collapseSidebarBtn.title = isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';

  // Update icon based on collapsed state
  if (isCollapsed) {
    // Show icon with panel on right (sidebar collapsed, can expand)
    collapseSidebarBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="15" y1="3" x2="15" y2="21"/>
      </svg>
    `;
  } else {
    // Show icon with panel on left (sidebar expanded, can collapse)
    collapseSidebarBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
      </svg>
    `;
  }
}

function renderSidebar() {
  sidebarList.innerHTML = '';

  // Add PLANNER item first (special item)
  const plannerItem = document.createElement('li');
  plannerItem.className = `sidebar-item${currentView === 'planner' ? ' active' : ''}`;
  const taskCount = todos.length;
  const eventCount = calendarEvents.length;
  plannerItem.innerHTML = `
    <div class="sidebar-item-content">
      <div class="sidebar-item-title">PLANNER</div>
      <div class="sidebar-item-preview">${taskCount} task${taskCount !== 1 ? 's' : ''} • ${eventCount} event${eventCount !== 1 ? 's' : ''}</div>
    </div>
  `;
  plannerItem.addEventListener('click', () => showPlannerView());
  sidebarList.appendChild(plannerItem);

  // Add notes
  notes.forEach(note => {
    const li = document.createElement('li');
    li.className = `sidebar-item${currentView === 'note' && currentNoteId === note.id ? ' active' : ''}`;
    li.draggable = true;
    li.dataset.noteId = note.id;

    // Drag and drop event listeners for notes
    li.addEventListener('dragstart', handleNoteDragStart);
    li.addEventListener('dragover', handleNoteDragOver);
    li.addEventListener('drop', handleNoteDrop);
    li.addEventListener('dragenter', handleNoteDragEnter);
    li.addEventListener('dragleave', handleNoteDragLeave);
    li.addEventListener('dragend', handleNoteDragEnd);

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
        <div class="sidebar-item-preview" style="text-align: center;">No notes yet. Click "Add Note" to create one.</div>
      </div>
    `;
    sidebarList.appendChild(emptyMsg);
  }
}

// Simple search functionality (without external dependencies)
function buildSearchIndex() {
  // No index building needed for simple text search
  // This function exists for compatibility but does nothing
}

// Search Modal functions
function openSearchModal() {
  searchModal.classList.remove('hidden');
  searchModalInput.value = '';
  searchModalInput.focus();
  renderSearchResults('');
}

function closeSearchModal() {
  searchModal.classList.add('hidden');
  searchModalInput.value = '';
  searchResults.innerHTML = '';
}

function handleSearchModalInput(e) {
  const query = e.target.value.trim();
  renderSearchResults(query);
}

function renderSearchResults(query) {
  searchResults.innerHTML = '';

  if (!query) {
    searchResults.innerHTML = '<div class="search-results-empty">Start typing to search notes...</div>';
    return;
  }

  if (notes.length === 0) {
    searchResults.innerHTML = '<div class="search-results-empty">No notes to search</div>';
    return;
  }

  // Simple text-based search (case-insensitive)
  const searchTerm = query.toLowerCase();
  const filteredNotes = notes.filter(note => {
    const title = (note.title || 'Untitled').toLowerCase();
    const content = (note.content || '').toLowerCase();
    return title.includes(searchTerm) || content.includes(searchTerm);
  });

  if (filteredNotes.length === 0) {
    searchResults.innerHTML = `<div class="search-results-empty">No notes found for "${query}"</div>`;
    return;
  }

  filteredNotes.forEach(note => {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';

    const previewText = note.content ? note.content.substring(0, 100) : '';
    resultItem.innerHTML = `
      <div class="search-result-title">${note.title || 'Untitled'}</div>
      <div class="search-result-preview">${previewText}${note.content && note.content.length > 100 ? '...' : ''}</div>
    `;

    resultItem.addEventListener('click', () => {
      showNoteView(note.id);
      closeSearchModal();
    });

    searchResults.appendChild(resultItem);
  });
}

// View switching functions
function showView(view) {
  // Hide all views and remove fade-in
  plannerView.classList.remove('fade-in');
  noteView.classList.remove('fade-in');
  welcomeView.classList.remove('fade-in');
  plannerView.classList.add('hidden');
  noteView.classList.add('hidden');
  welcomeView.classList.add('hidden');

  // Show selected view with fade animation
  if (view === 'planner') {
    plannerView.classList.remove('hidden');
    setTimeout(() => plannerView.classList.add('fade-in'), 10);
    // Hide note action buttons
    deleteNoteBtn.classList.add('hidden');
    copyMarkdown.classList.add('hidden');
    togglePreview.classList.add('hidden');
    exportToNotion.classList.add('hidden');
  } else if (view === 'note') {
    noteView.classList.remove('hidden');
    setTimeout(() => noteView.classList.add('fade-in'), 10);
    // Show note action buttons (delete button visibility handled in showNoteView)
    copyMarkdown.classList.remove('hidden');
    togglePreview.classList.remove('hidden');
    exportToNotion.classList.remove('hidden');
  } else {
    welcomeView.classList.remove('hidden');
    setTimeout(() => welcomeView.classList.add('fade-in'), 10);
    // Hide note action buttons
    deleteNoteBtn.classList.add('hidden');
    copyMarkdown.classList.add('hidden');
    togglePreview.classList.add('hidden');
    exportToNotion.classList.add('hidden');
  }

  currentView = view;
  renderSidebar();
}

function showPlannerView() {
  showView('planner');
  currentNoteId = null;
  renderPlannerTodos();
  // No need to fetch here - background fetch handles it
  // Just render what we have (either from cache or from background fetch)
  if (isCalendarConnected && calendarEvents.length > 0) {
    renderCalendarEvents();
  }
}

function showNoteView(noteId) {
  const note = notes.find(n => n.id === noteId);
  if (!note) return;

  currentNoteId = noteId;
  isPreviewMode = false;

  noteTitleInput.value = note.title || '';
  noteContentInput.value = note.content || '';

  noteContentInput.classList.remove('hidden');
  notePreview.classList.add('hidden');
  noteTitleInput.disabled = false;
  noteTitleInput.style.opacity = '1';

  deleteNoteBtn.classList.remove('hidden');
  togglePreview.classList.remove('active');
  togglePreview.title = 'Toggle Preview';

  // Reset copy button state when switching notes
  resetCopyButton();

  showView('note');
  setTimeout(() => {
    autoResizeTitle();
    autoResizeContent();
    noteTitleInput.focus();
  }, 100);
}

function togglePreviewMode() {
  if (!currentNoteId) return;

  isPreviewMode = !isPreviewMode;

  if (isPreviewMode) {
    // Switch to preview mode
    const content = noteContentInput.value;
    notePreview.innerHTML = marked.parse(content);
    noteContentInput.classList.add('hidden');
    notePreview.classList.remove('hidden');
    noteTitleInput.disabled = true;
    noteTitleInput.style.opacity = '0.8';
    togglePreview.classList.add('active');
    togglePreview.title = 'Edit Mode';
  } else {
    // Switch to edit mode
    noteContentInput.classList.remove('hidden');
    notePreview.classList.add('hidden');
    noteTitleInput.disabled = false;
    noteTitleInput.style.opacity = '1';
    togglePreview.classList.remove('active');
    togglePreview.title = 'Toggle Preview';
    noteContentInput.focus();
  }
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

// Auto-resize title textarea
function autoResizeTitle() {
  noteTitleInput.style.height = 'auto';
  noteTitleInput.style.height = noteTitleInput.scrollHeight + 'px';
}

// Auto-resize content textarea
function autoResizeContent() {
  noteContentInput.style.height = 'auto';
  noteContentInput.style.height = noteContentInput.scrollHeight + 'px';
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
  }
}

function saveTodos() {
  localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
  renderSidebar(); // Update task count in sidebar
}

function showAddPlannerTodoActions() {
  plannerTodoInputActions.classList.remove('hidden');
}

function hideAddPlannerTodoActions() {
  plannerTodoInputActions.classList.add('hidden');
}

function cancelAddPlannerTodo() {
  plannerTodoInput.value = '';
  hideAddPlannerTodoActions();
  plannerTodoInput.blur();
}

function addTodo() {
  const text = plannerTodoInput.value.trim();
  if (text === '') return;

  const todo = {
    id: Date.now(),
    text: text,
    completed: false
  };

  todos.push(todo);
  saveTodos();
  renderPlannerTodos();
  plannerTodoInput.value = '';
  hideAddPlannerTodoActions();
  plannerTodoInput.focus();
}

function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    saveTodos();
    renderPlannerTodos();
  }
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  saveTodos();
  renderPlannerTodos();
}

function editTodo(id, newText) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.text = newText;
    saveTodos();
    renderPlannerTodos();
  }
}

// Render planner todos (all tasks)
function renderPlannerTodos() {
  plannerTodoList.innerHTML = '';

  if (todos.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.style.color = '#909090';
    emptyMsg.style.fontSize = '14px';
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.padding = '40px 20px';
    emptyMsg.textContent = 'No tasks yet. Add one above!';
    plannerTodoList.appendChild(emptyMsg);
    return;
  }

  todos.forEach(todo => {
    const li = document.createElement('li');
    li.className = `todo-item${todo.completed ? ' completed' : ''}`;
    li.draggable = true;
    li.dataset.id = todo.id;

    // Drag and drop event listeners
    li.addEventListener('dragstart', handleTodoDragStart);
    li.addEventListener('dragover', handleTodoDragOver);
    li.addEventListener('drop', handleTodoDrop);
    li.addEventListener('dragenter', handleTodoDragEnter);
    li.addEventListener('dragleave', handleTodoDragLeave);
    li.addEventListener('dragend', handleTodoDragEnd);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => toggleTodo(todo.id));

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;

    // Create edit button with pen icon
    const editBtn = document.createElement('button');
    editBtn.className = 'todo-edit-btn';
    editBtn.title = 'Edit';
    editBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    `;
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      enterEditModePlanner(li, todo);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'todo-delete';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
        <line x1="10" y1="11" x2="10" y2="17"/>
        <line x1="14" y1="11" x2="14" y2="17"/>
      </svg>
    `;
    deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

    li.appendChild(checkbox);
    li.appendChild(text);
    li.appendChild(editBtn);
    li.appendChild(deleteBtn);
    plannerTodoList.appendChild(li);
  });
}

function enterEditModePlanner(li, todo) {
  // Add editing class for styling
  li.classList.add('editing');

  // Find and hide the text, edit button, and delete button
  const text = li.querySelector('.todo-text');
  const editBtn = li.querySelector('.todo-edit-btn');
  const deleteBtn = li.querySelector('.todo-delete');

  text.style.display = 'none';
  editBtn.style.display = 'none';
  deleteBtn.style.display = 'none';

  // Create input field
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'todo-edit-input';
  input.value = todo.text;

  // Create action buttons container
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'todo-edit-actions';

  // Create Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'todo-edit-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    renderPlannerTodos();
  });

  // Create Save button
  const saveBtn = document.createElement('button');
  saveBtn.className = 'todo-edit-save';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const newText = input.value.trim();
    if (newText !== '' && newText !== todo.text) {
      editTodo(todo.id, newText);
    } else {
      renderPlannerTodos();
    }
  });

  // Add buttons to actions div
  actionsDiv.appendChild(cancelBtn);
  actionsDiv.appendChild(saveBtn);

  // Insert input and actions after checkbox
  const checkbox = li.querySelector('.todo-checkbox');
  checkbox.after(input);
  input.after(actionsDiv);

  // Focus and select input
  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);

  // Save on Enter key
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const newText = input.value.trim();
      if (newText !== '' && newText !== todo.text) {
        editTodo(todo.id, newText);
      } else {
        renderPlannerTodos();
      }
    }
  });

  // Cancel on Escape key
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      renderPlannerTodos();
    }
  });
}

// Drag and drop handlers for todos
let draggedTodoElement = null;
let draggedNoteElement = null;

function handleTodoDragStart(e) {
  draggedTodoElement = e.target;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.target.innerHTML);
}

function handleTodoDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleTodoDragEnter(e) {
  if (e.target.classList.contains('todo-item') && e.target !== draggedTodoElement) {
    e.target.classList.add('drag-over');
  }
}

function handleTodoDragLeave(e) {
  if (e.target.classList.contains('todo-item')) {
    e.target.classList.remove('drag-over');
  }
}

function handleTodoDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  e.preventDefault();

  if (draggedTodoElement !== e.target && e.target.classList.contains('todo-item')) {
    const draggedId = parseInt(draggedTodoElement.dataset.id);
    const targetId = parseInt(e.target.dataset.id);

    const draggedIndex = todos.findIndex(t => t.id === draggedId);
    const targetIndex = todos.findIndex(t => t.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      // Remove dragged item and insert at new position
      const [draggedItem] = todos.splice(draggedIndex, 1);
      todos.splice(targetIndex, 0, draggedItem);

      saveTodos();
      renderPlannerTodos();
    }
  }

  e.target.classList.remove('drag-over');
  return false;
}

function handleTodoDragEnd(e) {
  e.target.classList.remove('dragging');
  // Remove drag-over class from all items
  document.querySelectorAll('.todo-item').forEach(item => {
    item.classList.remove('drag-over');
  });
}

// Drag and drop handlers for notes
function handleNoteDragStart(e) {
  draggedNoteElement = e.currentTarget;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
}

function handleNoteDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleNoteDragEnter(e) {
  const target = e.currentTarget;
  if (target.classList.contains('sidebar-item') && target.draggable && target !== draggedNoteElement) {
    target.classList.add('drag-over');
  }
}

function handleNoteDragLeave(e) {
  const target = e.currentTarget;
  if (target.classList.contains('sidebar-item')) {
    target.classList.remove('drag-over');
  }
}

function handleNoteDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  e.preventDefault();

  const target = e.currentTarget;
  if (draggedNoteElement !== target && target.classList.contains('sidebar-item') && target.draggable) {
    const draggedId = parseInt(draggedNoteElement.dataset.noteId);
    const targetId = parseInt(target.dataset.noteId);

    const draggedIndex = notes.findIndex(n => n.id === draggedId);
    const targetIndex = notes.findIndex(n => n.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      // Remove dragged item and insert at new position
      const [draggedItem] = notes.splice(draggedIndex, 1);
      notes.splice(targetIndex, 0, draggedItem);

      saveNotesData();
      renderSidebar();
    }
  }

  target.classList.remove('drag-over');
  return false;
}

function handleNoteDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  // Remove drag-over class from all sidebar items
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('drag-over');
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
    buildSearchIndex();
    renderSidebar();
  }
}

function saveNotesData() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  buildSearchIndex();
}

function confirmDeleteNote() {
  if (!currentNoteId) return;

  if (confirm('Are you sure you want to delete this note?')) {
    notes = notes.filter(n => n.id !== currentNoteId);
    saveNotesData();
    renderSidebar();

    // Show Planner view after deleting
    showPlannerView();
  }
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
  // Clear any existing timeout
  if (copyButtonTimeout) {
    clearTimeout(copyButtonTimeout);
  }

  // Change button style to show feedback
  copyMarkdown.style.backgroundColor = isError ? '#c04040' : '#4a4a4a';
  copyMarkdown.style.color = '#fff';
  copyMarkdown.style.borderColor = isError ? '#c04040' : '#4a4a4a';

  copyButtonTimeout = setTimeout(() => {
    copyMarkdown.style.backgroundColor = '';
    copyMarkdown.style.color = '';
    copyMarkdown.style.borderColor = '';
    copyButtonTimeout = null;
  }, 2000);
}

function resetCopyButton() {
  // Clear any pending timeout
  if (copyButtonTimeout) {
    clearTimeout(copyButtonTimeout);
    copyButtonTimeout = null;
  }

  // Reset button to original state
  copyMarkdown.style.backgroundColor = '';
  copyMarkdown.style.color = '';
  copyMarkdown.style.borderColor = '';
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

// Settings functions
function loadSettings() {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    try {
      settings = JSON.parse(stored);
      // Ensure fontStyle exists for backwards compatibility
      if (!settings.fontStyle) {
        settings.fontStyle = 'mono';
      }
      // Ensure googleClientId exists for backwards compatibility
      if (!settings.googleClientId) {
        settings.googleClientId = '';
      }
      // Ensure Supabase settings exist for backwards compatibility
      if (!settings.supabaseUrl) {
        settings.supabaseUrl = '';
      }
      if (!settings.supabaseKey) {
        settings.supabaseKey = '';
      }
    } catch (e) {
      settings = {
        notionApiKey: '',
        notionDatabaseId: '',
        fontStyle: 'mono',
        googleClientId: '',
        supabaseUrl: '',
        supabaseKey: ''
      };
    }
  }
  applyFontStyle();
}

function applyFontStyle() {
  if (settings.fontStyle === 'handwriting') {
    document.body.classList.add('handwriting-font');
  } else {
    document.body.classList.remove('handwriting-font');
  }
}

function openSettingsModal() {
  fontStyle.value = settings.fontStyle || 'mono';
  googleClientId.value = settings.googleClientId || '';
  notionApiKey.value = settings.notionApiKey || '';
  notionDatabaseId.value = settings.notionDatabaseId || '';
  supabaseUrl.value = settings.supabaseUrl || '';
  supabaseKey.value = settings.supabaseKey || '';
  updateAuthUI();
  settingsModal.classList.add('show');
}

function closeSettingsModal() {
  settingsModal.classList.remove('show');
}

async function saveSettingsData() {
  settings.fontStyle = fontStyle.value;
  settings.googleClientId = googleClientId.value.trim();
  settings.notionApiKey = notionApiKey.value.trim();
  settings.notionDatabaseId = notionDatabaseId.value.trim();
  settings.supabaseUrl = supabaseUrl.value.trim();
  settings.supabaseKey = supabaseKey.value.trim();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applyFontStyle();

  // Reinitialize Supabase if credentials changed
  if (settings.supabaseUrl && settings.supabaseKey) {
    await initializeSupabase();
    await checkAuthStatus();
  }

  // Sync to Supabase if authenticated
  await syncTokensToSupabase();

  closeSettingsModal();
  alert('Settings saved!');
}

// Google Calendar Integration
function loadCalendarToken() {
  const stored = localStorage.getItem(CALENDAR_TOKEN_KEY);
  if (stored) {
    try {
      calendarToken = JSON.parse(stored);
      isCalendarConnected = true;
      // Don't fetch here - background fetch will handle it
    } catch (e) {
      calendarToken = null;
      isCalendarConnected = false;
    }
  }
}

async function saveCalendarToken(token) {
  calendarToken = token;
  isCalendarConnected = true;
  localStorage.setItem(CALENDAR_TOKEN_KEY, JSON.stringify(token));

  // Sync to Supabase if authenticated
  await syncTokensToSupabase();
}

function loadCachedCalendarEvents() {
  const stored = localStorage.getItem(CALENDAR_EVENTS_KEY);
  if (stored) {
    try {
      const cached = JSON.parse(stored);
      if (cached && cached.events && cached.timestamp) {
        // Only use cached events if they're less than 5 minutes old
        const age = Date.now() - cached.timestamp;
        if (age < 5 * 60 * 1000) {
          calendarEvents = cached.events;
          renderCalendarEvents();
        }
      }
    } catch (e) {
      console.error('Failed to load cached calendar events:', e);
    }
  }
}

function saveCachedCalendarEvents(events) {
  try {
    const cache = {
      events: events,
      timestamp: Date.now()
    };
    localStorage.setItem(CALENDAR_EVENTS_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to cache calendar events:', e);
  }
}

function startCalendarBackgroundFetch() {
  // Clear any existing interval
  if (calendarFetchInterval) {
    clearInterval(calendarFetchInterval);
  }

  // Fetch immediately if connected
  if (isCalendarConnected) {
    fetchCalendarEvents();
  }

  // Set up periodic fetch every minute
  calendarFetchInterval = setInterval(() => {
    if (isCalendarConnected) {
      fetchCalendarEvents();
    }
  }, 60 * 1000); // 60 seconds
}

async function connectGoogleCalendar() {
  // Check if client ID is configured
  if (!settings.googleClientId || settings.googleClientId === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
    alert('Please configure your Google OAuth Client ID in Settings first.');
    openSettingsModal();
    return;
  }

  try {
    // Use Chrome Identity API for OAuth
    const redirectURL = chrome.identity.getRedirectURL();
    const clientID = settings.googleClientId;
    const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
    let authURL = 'https://accounts.google.com/o/oauth2/auth';
    authURL += `?client_id=${clientID}`;
    authURL += `&response_type=token`;
    authURL += `&redirect_uri=${encodeURIComponent(redirectURL)}`;
    authURL += `&scope=${encodeURIComponent(scopes.join(' '))}`;

    console.log('=== Google Calendar OAuth Configuration ===');
    console.log('Extension ID:', chrome.runtime.id);
    console.log('Redirect URI:', redirectURL);
    console.log('Client ID:', clientID);
    console.log('\n📋 COPY THIS REDIRECT URI TO GOOGLE CLOUD CONSOLE:');
    console.log(redirectURL);
    console.log('\n📖 Instructions:');
    console.log('1. Go to: https://console.cloud.google.com/apis/credentials');
    console.log('2. Click on your OAuth 2.0 Client ID');
    console.log('3. Under "Authorized redirect URIs", click "ADD URI"');
    console.log('4. Paste the redirect URI above');
    console.log('5. Click Save');
    console.log('==========================================\n');

    chrome.identity.launchWebAuthFlow(
      {
        url: authURL,
        interactive: true
      },
      function(responseURL) {
        if (chrome.runtime.lastError) {
          console.error('Auth error:', chrome.runtime.lastError);
          calendarStatus.innerHTML = '<p class="calendar-error">Failed to connect. Please try again.</p>';
          return;
        }

        console.log('OAuth response received');

        // Parse all parameters from URL hash
        const urlParams = new URLSearchParams(responseURL.split('#')[1]);
        const accessToken = urlParams.get('access_token');
        const expiresIn = parseInt(urlParams.get('expires_in') || '3600', 10); // Default to 1 hour

        if (accessToken) {
          const expiresAt = Date.now() + (expiresIn * 1000);
          console.log(`Token obtained, expires in ${expiresIn} seconds (at ${new Date(expiresAt).toLocaleString()})`);

          saveCalendarToken({
            access_token: accessToken,
            timestamp: Date.now(),
            expires_at: expiresAt,
            expires_in: expiresIn
          });
          calendarStatus.innerHTML = '<p class="calendar-loading">Loading events...</p>';
          startCalendarBackgroundFetch();
        } else {
          console.error('No access token in response');
          calendarStatus.innerHTML = '<p class="calendar-error">Failed to get access token.</p>';
        }
      }
    );
  } catch (error) {
    console.error('Calendar connection error:', error);
    calendarStatus.innerHTML = '<p class="calendar-error">Failed to connect to Google Calendar.</p>';
  }
}

async function fetchCalendarEvents(showLoading = false) {
  if (!isCalendarConnected || !calendarToken) {
    calendarStatus.classList.remove('hidden');
    calendarEventsList.classList.add('hidden');
    return;
  }

  // Check if token has expired
  const now = Date.now();
  if (calendarToken.expires_at && now >= calendarToken.expires_at) {
    console.log('Token has expired, clearing connection');
    localStorage.removeItem(CALENDAR_TOKEN_KEY);
    localStorage.removeItem(CALENDAR_EVENTS_KEY);
    calendarToken = null;
    isCalendarConnected = false;
    calendarEvents = [];
    if (calendarFetchInterval) {
      clearInterval(calendarFetchInterval);
      calendarFetchInterval = null;
    }
    calendarStatus.innerHTML = '<button id="connectCalendar" class="btn-primary">Connect Google Calendar</button><p class="calendar-error">Session expired. Please reconnect.</p>';
    calendarStatus.classList.remove('hidden');
    calendarEventsList.classList.add('hidden');
    document.getElementById('connectCalendar').addEventListener('click', connectGoogleCalendar);
    return;
  }

  // Check if token will expire soon (within 5 minutes) and log warning
  const timeUntilExpiry = calendarToken.expires_at ? calendarToken.expires_at - now : Infinity;
  if (timeUntilExpiry < 5 * 60 * 1000) {
    console.warn(`Token will expire in ${Math.floor(timeUntilExpiry / 1000)} seconds. Consider re-authenticating.`);
  }

  // Only show loading indicator if explicitly requested (e.g., manual refresh)
  if (showLoading) {
    calendarStatus.innerHTML = '<p class="calendar-loading">Loading events...</p>';
    calendarStatus.classList.remove('hidden');
    calendarEventsList.classList.add('hidden');
  }

  try {
    // Get today's start and end times
    const currentDate = new Date();
    const startOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0);
    const endOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59);

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${startOfDay.toISOString()}&` +
      `timeMax=${endOfDay.toISOString()}&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${calendarToken.access_token}`
        }
      }
    );

    if (response.status === 401) {
      // Token expired or invalid, clear it
      console.log('Received 401 Unauthorized, token is invalid');
      localStorage.removeItem(CALENDAR_TOKEN_KEY);
      localStorage.removeItem(CALENDAR_EVENTS_KEY);
      calendarToken = null;
      isCalendarConnected = false;
      calendarEvents = [];
      if (calendarFetchInterval) {
        clearInterval(calendarFetchInterval);
        calendarFetchInterval = null;
      }
      calendarStatus.innerHTML = '<button id="connectCalendar" class="btn-primary">Connect Google Calendar</button><p class="calendar-error">Session expired. Please reconnect.</p>';
      calendarStatus.classList.remove('hidden');
      calendarEventsList.classList.add('hidden');
      document.getElementById('connectCalendar').addEventListener('click', connectGoogleCalendar);
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch calendar events');
    }

    const data = await response.json();
    const allEvents = data.items || [];

    // Filter to show only ongoing or upcoming events
    const currentTime = new Date();
    calendarEvents = allEvents.filter(event => {
      if (event.start.dateTime) {
        const endTime = new Date(event.end.dateTime);
        // Include event if it hasn't ended yet
        return endTime >= currentTime;
      } else {
        // All-day events are always included
        return true;
      }
    });

    // Save to cache
    saveCachedCalendarEvents(calendarEvents);

    renderCalendarEvents();
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    // Only show error if we don't have cached events to display
    if (calendarEvents.length === 0) {
      calendarStatus.innerHTML = '<p class="calendar-error">Failed to load events. <button id="retryCalendar" class="btn-secondary" style="margin-top: 12px;">Retry</button></p>';
      calendarStatus.classList.remove('hidden');
      calendarEventsList.classList.add('hidden');
      document.getElementById('retryCalendar')?.addEventListener('click', () => fetchCalendarEvents(true));
    }
  }
}

function renderCalendarEvents() {
  calendarEventsList.innerHTML = '';
  calendarStatus.classList.add('hidden');
  calendarEventsList.classList.remove('hidden');

  if (calendarEvents.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'calendar-empty';
    emptyMsg.textContent = 'No upcoming events for today';
    calendarEventsList.appendChild(emptyMsg);
    renderSidebar();
    return;
  }

  calendarEvents.forEach(event => {
    const li = document.createElement('li');
    li.className = 'calendar-event-item';

    const timeDiv = document.createElement('div');
    timeDiv.className = 'calendar-event-time';

    if (event.start.dateTime) {
      const start = new Date(event.start.dateTime);
      const end = new Date(event.end.dateTime);
      const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      timeDiv.textContent = `${startTime} - ${endTime}`;
    } else {
      timeDiv.textContent = 'All day';
    }

    const titleDiv = document.createElement('div');
    titleDiv.className = 'calendar-event-title';
    titleDiv.textContent = event.summary || 'Untitled Event';

    li.appendChild(timeDiv);
    li.appendChild(titleDiv);

    // Extract links from event
    const links = extractEventLinks(event);
    if (links.length > 0) {
      const linksDiv = document.createElement('div');
      linksDiv.className = 'calendar-event-links';

      links.forEach(link => {
        const linkContainer = document.createElement('div');
        linkContainer.className = 'calendar-event-link-container';

        const linkElement = document.createElement('a');
        linkElement.href = link.url;
        linkElement.target = '_blank';
        linkElement.rel = 'noopener noreferrer';
        linkElement.className = 'calendar-event-link';
        linkElement.title = link.title;

        // Set icon based on link type
        let iconSvg = '';

        if (link.linkType === 'video') {
          // Video call icon
          iconSvg = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 7l-7 5 7 5V7z"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          `;
        } else if (link.linkType === 'docs') {
          // Google Docs icon
          iconSvg = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          `;
        } else if (link.linkType === 'pdf') {
          // PDF icon
          iconSvg = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="M10 12h4"/>
              <path d="M10 16h2"/>
            </svg>
          `;
        } else if (link.linkType === 'notion') {
          // Notion icon
          iconSvg = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 7V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/>
              <path d="M9 12h10"/>
              <path d="M9 16h6"/>
            </svg>
          `;
        } else {
          // Generic link icon
          iconSvg = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          `;
        }

        linkElement.innerHTML = iconSvg;

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'calendar-event-link-tooltip';
        tooltip.textContent = link.url;

        linkContainer.appendChild(linkElement);
        linkContainer.appendChild(tooltip);
        linksDiv.appendChild(linkContainer);
      });

      li.appendChild(linksDiv);
    } else if (event.location && !isUrl(event.location)) {
      // Only show location text if it's not a URL
      const locationDiv = document.createElement('div');
      locationDiv.className = 'calendar-event-location';
      locationDiv.textContent = event.location;
      li.appendChild(locationDiv);
    }

    calendarEventsList.appendChild(li);
  });

  renderSidebar();
}

function extractEventLinks(event) {
  const links = [];
  const seenUrls = new Set();

  // Helper to check if URL is a tel link or phone meeting link
  const isTelOrPhoneLink = (url) => {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    // Filter out tel: protocol links
    if (urlLower.startsWith('tel:')) return true;
    // Filter out tel.meet links (e.g., https://tel.meet/...)
    if (urlLower.startsWith('https://tel.meet') ||
        urlLower.startsWith('http://tel.meet')) return true;
    // Filter out Google Meet tel links (e.g., https://meet.google.com/tel/...)
    if (urlLower.startsWith('https://meet.google.com/tel/') ||
        urlLower.startsWith('http://meet.google.com/tel/')) return true;
    // Filter out URLs with /tel/ in path
    if (urlLower.includes('/tel/')) return true;
    // Filter out phone dial-in patterns
    if (urlLower.includes('dial') && urlLower.includes('pin')) return true;
    return false;
  };

  // Helper to add link if not already seen and not a phone link
  const addLink = (url, title) => {
    if (url && !seenUrls.has(url) && !isTelOrPhoneLink(url)) {
      seenUrls.add(url);
      const linkType = getLinkType(url);
      links.push({ url, title, linkType });
    }
  };

  // Check for Google Meet link (hangoutLink)
  if (event.hangoutLink) {
    addLink(event.hangoutLink, 'Join Google Meet');
  }

  // Check for conference data (Zoom, Teams, etc.)
  if (event.conferenceData?.entryPoints) {
    event.conferenceData.entryPoints.forEach(entry => {
      // Skip phone entry points
      if (entry.uri && entry.entryPointType !== 'phone') {
        addLink(entry.uri, entry.label || 'Join meeting');
      }
    });
  }

  // Check location field for URLs
  if (event.location && isUrl(event.location)) {
    addLink(event.location, 'Location');
  }

  // Check description for URLs
  if (event.description) {
    const urlRegex = /https?:\/\/[^\s<>"]+/g;
    const matches = event.description.match(urlRegex);
    if (matches) {
      matches.forEach(url => {
        addLink(url, 'Link');
      });
    }
  }

  return links;
}

function isUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function getLinkType(url) {
  const urlLower = url.toLowerCase();

  // Check for Google Docs
  if (urlLower.includes('docs.google.com/document') ||
      urlLower.includes('docs.google.com/spreadsheets') ||
      urlLower.includes('docs.google.com/presentation')) {
    return 'docs';
  }

  // Check for PDF
  if (urlLower.endsWith('.pdf') || urlLower.includes('.pdf?') || urlLower.includes('.pdf#')) {
    return 'pdf';
  }

  // Check for Notion
  if (urlLower.includes('notion.so') || urlLower.includes('notion.site')) {
    return 'notion';
  }

  // Check for video calls
  if (isVideoCallUrl(url)) {
    return 'video';
  }

  return 'generic';
}

function isVideoCallUrl(url) {
  const videoCallDomains = [
    'meet.google.com',
    'zoom.us',
    'teams.microsoft.com',
    'teams.live.com',
    'webex.com',
    'whereby.com',
    'gotomeeting.com',
    'bluejeans.com'
  ];

  try {
    const urlObj = new URL(url);
    return videoCallDomains.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

// Clock functions
function updateClock() {
  const now = new Date();

  // Format time
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  timeDisplay.textContent = `${hours}:${minutes}`;

  // Format date
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayName = days[now.getDay()];
  const monthName = months[now.getMonth()];
  const date = now.getDate();
  const year = now.getFullYear();

  dateDisplay.textContent = `${dayName}, ${monthName} ${date}, ${year}`;
}

// ===== Supabase Authentication Functions =====

/**
 * Initialize Supabase client with stored credentials
 */
async function initializeSupabase() {
  if (!settings.supabaseUrl || !settings.supabaseKey) {
    console.log('Supabase credentials not configured');
    isSupabaseInitialized = false;
    return;
  }

  try {
    const client = initSupabase(settings.supabaseUrl, settings.supabaseKey);
    if (client) {
      isSupabaseInitialized = true;
      console.log('Supabase initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing Supabase:', error);
    isSupabaseInitialized = false;
  }
}

/**
 * Check current authentication status
 */
async function checkAuthStatus() {
  if (!isSupabaseInitialized) {
    return;
  }

  try {
    const user = await getCurrentUser();
    currentUser = user;
    
    if (user) {
      console.log('User is authenticated:', user.email);
      // Load tokens from Supabase
      await syncTokensFromSupabase();
    } else {
      console.log('No authenticated user');
    }
    
    updateAuthUI();
  } catch (error) {
    console.error('Error checking auth status:', error);
  }
}

/**
 * Handle sign in with Google
 */
async function handleSignInWithGoogle() {
  if (!settings.googleClientId) {
    showAuthStatus('Please configure Google Client ID in settings first', 'error');
    return;
  }

  try {
    showAuthStatus('Opening Google sign-in...', 'info');
    const result = await signInWithGoogle(settings.googleClientId);

    // Store the Google access token for Calendar API
    calendarToken = {
      access_token: result.accessToken,
      timestamp: Date.now(),
      expires_at: Date.now() + (result.expiresIn * 1000),
      expires_in: result.expiresIn
    };
    localStorage.setItem(CALENDAR_TOKEN_KEY, JSON.stringify(calendarToken));
    isCalendarConnected = true;

    // Update current user
    currentUser = result.user;
    showAuthStatus('Signed in successfully!', 'success');
    updateAuthUI();

    // Sync data and start calendar fetch
    await syncTokensFromSupabase();
    await fetchCalendarEvents(true);
  } catch (error) {
    console.error('Sign in error:', error);
    showAuthStatus(error.message || 'Sign in failed', 'error');
  }
}

/**
 * Handle sign out
 */
async function handleSignOut() {
  try {
    showAuthStatus('Signing out...', 'info');
    await signOut();
    currentUser = null;
    showAuthStatus('Signed out successfully', 'success');
    updateAuthUI();
  } catch (error) {
    console.error('Sign out error:', error);
    showAuthStatus(error.message || 'Sign out failed', 'error');
  }
}

/**
 * Handle Supabase config change
 */
function handleSupabaseConfigChange() {
  const url = supabaseUrl.value.trim();
  const key = supabaseKey.value.trim();
  
  if (url && key) {
    authContainer.classList.remove('hidden');
  } else {
    authContainer.classList.add('hidden');
  }
}

/**
 * Handle auth state changes from Supabase
 */
async function handleAuthStateChange(event) {
  const { event: authEvent, session } = event.detail;
  
  console.log('Auth state changed:', authEvent);
  
  if (authEvent === 'SIGNED_IN') {
    currentUser = session.user;
    await syncTokensFromSupabase();
  } else if (authEvent === 'SIGNED_OUT') {
    currentUser = null;
  }
  
  updateAuthUI();
}

/**
 * Update authentication UI based on current state
 */
function updateAuthUI() {
  if (!isSupabaseInitialized) {
    authContainer.classList.add('hidden');
    showAuthStatus('Configure Supabase URL and Anon Key to enable authentication', 'info');
    return;
  }

  if (!settings.googleClientId) {
    authContainer.classList.add('hidden');
    showAuthStatus('Configure Google Client ID to enable sign-in', 'info');
    return;
  }

  authContainer.classList.remove('hidden');

  if (currentUser) {
    // User is signed in
    signInWithGoogleBtn.classList.add('hidden');
    signOutBtn.classList.remove('hidden');
    showAuthStatus(`Signed in as ${currentUser.email}`, 'success');
  } else {
    // User is not signed in
    signInWithGoogleBtn.classList.remove('hidden');
    signOutBtn.classList.add('hidden');
    if (!authStatus.textContent || authStatus.textContent.includes('Signed out')) {
      showAuthStatus('Sign in with Google to access your calendar', 'info');
    }
  }
}

/**
 * Show authentication status message
 */
function showAuthStatus(message, type = 'info') {
  authStatus.textContent = message;
  authStatus.className = 'auth-status ' + type;
}

/**
 * Sync data from Supabase to localStorage
 * Note: Google Calendar token comes from OAuth provider_token, not stored separately
 */
async function syncTokensFromSupabase() {
  if (!currentUser) return;

  try {
    const userData = await getUserData();

    if (userData) {
      // Restore Notion credentials if exists
      if (userData.notionApiKey || userData.notionDatabaseId) {
        if (userData.notionApiKey) settings.notionApiKey = userData.notionApiKey;
        if (userData.notionDatabaseId) settings.notionDatabaseId = userData.notionDatabaseId;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      }

      console.log('User data synced from Supabase');
    }

    // Get Google Calendar token from OAuth session
    const googleToken = await getGoogleAccessToken();
    if (googleToken) {
      calendarToken = {
        access_token: googleToken,
        timestamp: Date.now(),
        expires_at: Date.now() + 3600000, // 1 hour (will be auto-refreshed by Supabase)
        expires_in: 3600
      };
      localStorage.setItem(CALENDAR_TOKEN_KEY, JSON.stringify(calendarToken));
      isCalendarConnected = true;
      console.log('Google Calendar token obtained from OAuth session');
    }
  } catch (error) {
    console.error('Error syncing from Supabase:', error);
  }
}

/**
 * Sync Notion credentials to Supabase
 * Note: Google Calendar token is managed by Supabase OAuth, not stored separately
 */
async function syncTokensToSupabase() {
  if (!currentUser || !isSupabaseInitialized) {
    return;
  }

  try {
    const userData = {
      notionApiKey: settings.notionApiKey,
      notionDatabaseId: settings.notionDatabaseId
    };

    await updateUserData(userData);
    console.log('User data synced to Supabase');
  } catch (error) {
    console.error('Error syncing to Supabase:', error);
  }
}
