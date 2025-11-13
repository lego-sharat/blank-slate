// Storage keys
const TODOS_KEY = 'minimal_newtab_todos';
const NOTES_KEY = 'minimal_newtab_notes';
const SETTINGS_KEY = 'minimal_newtab_settings';
const CALENDAR_TOKEN_KEY = 'minimal_newtab_calendar_token';

// State
let todos = [];
let notes = [];
let settings = { notionApiKey: '', notionDatabaseId: '', fontStyle: 'mono', googleClientId: '' };
let currentNoteId = null;
let currentView = 'planner'; // 'planner' or 'note'
let isPreviewMode = false;
let copyButtonTimeout = null;
let calendarEvents = [];
let calendarToken = null;
let isCalendarConnected = false;

// DOM elements - Sidebar
const sidebar = document.querySelector('.sidebar');
const sidebarList = document.getElementById('sidebarList');
const addNoteBtn = document.getElementById('addNoteBtn');
const collapseSidebarBtn = document.getElementById('collapseSidebarBtn');

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

// DOM elements - Clock
const timeDisplay = document.getElementById('timeDisplay');
const dateDisplay = document.getElementById('dateDisplay');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadTodos();
  loadNotes();
  loadSettings();
  loadCalendarToken();
  setupEventListeners();
  updateClock();
  setInterval(updateClock, 1000);
  renderSidebar();
  showPlannerView();
});

// Setup event listeners
function setupEventListeners() {
  // Sidebar
  collapseSidebarBtn.addEventListener('click', toggleSidebar);
  addNoteBtn.addEventListener('click', () => createNewNote());

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
  refreshCalendar.addEventListener('click', fetchCalendarEvents);

  // Notes
  deleteNoteBtn.addEventListener('click', confirmDeleteNote);
  copyMarkdown.addEventListener('click', copyCurrentNoteToClipboard);
  togglePreview.addEventListener('click', togglePreviewMode);
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
        <div class="sidebar-item-preview" style="text-align: center;">No notes yet. Click + to create one.</div>
      </div>
    `;
    sidebarList.appendChild(emptyMsg);
  }
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
  if (isCalendarConnected) {
    fetchCalendarEvents();
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
    renderSidebar();
  }
}

function saveNotesData() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
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
    } catch (e) {
      settings = { notionApiKey: '', notionDatabaseId: '', fontStyle: 'mono', googleClientId: '' };
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
  settingsModal.classList.add('show');
}

function closeSettingsModal() {
  settingsModal.classList.remove('show');
}

function saveSettingsData() {
  settings.fontStyle = fontStyle.value;
  settings.googleClientId = googleClientId.value.trim();
  settings.notionApiKey = notionApiKey.value.trim();
  settings.notionDatabaseId = notionDatabaseId.value.trim();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applyFontStyle();
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
      if (currentView === 'planner') {
        fetchCalendarEvents();
      }
    } catch (e) {
      calendarToken = null;
      isCalendarConnected = false;
    }
  }
}

function saveCalendarToken(token) {
  calendarToken = token;
  isCalendarConnected = true;
  localStorage.setItem(CALENDAR_TOKEN_KEY, JSON.stringify(token));
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

        // Extract access token from response URL
        const token = responseURL.split('access_token=')[1]?.split('&')[0];
        if (token) {
          saveCalendarToken({ access_token: token, timestamp: Date.now() });
          calendarStatus.innerHTML = '<p class="calendar-loading">Loading events...</p>';
          fetchCalendarEvents();
        } else {
          calendarStatus.innerHTML = '<p class="calendar-error">Failed to get access token.</p>';
        }
      }
    );
  } catch (error) {
    console.error('Calendar connection error:', error);
    calendarStatus.innerHTML = '<p class="calendar-error">Failed to connect to Google Calendar.</p>';
  }
}

async function fetchCalendarEvents() {
  if (!isCalendarConnected || !calendarToken) {
    calendarStatus.classList.remove('hidden');
    calendarEventsList.classList.add('hidden');
    return;
  }

  calendarStatus.innerHTML = '<p class="calendar-loading">Loading events...</p>';
  calendarStatus.classList.remove('hidden');
  calendarEventsList.classList.add('hidden');

  try {
    // Get today's start and end times
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

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
      // Token expired, clear it
      localStorage.removeItem(CALENDAR_TOKEN_KEY);
      calendarToken = null;
      isCalendarConnected = false;
      calendarStatus.innerHTML = '<button id="connectCalendar" class="btn-primary">Connect Google Calendar</button>';
      document.getElementById('connectCalendar').addEventListener('click', connectGoogleCalendar);
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch calendar events');
    }

    const data = await response.json();
    calendarEvents = data.items || [];
    renderCalendarEvents();
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    calendarStatus.innerHTML = '<p class="calendar-error">Failed to load events. <button id="retryCalendar" class="btn-secondary" style="margin-top: 12px;">Retry</button></p>';
    document.getElementById('retryCalendar')?.addEventListener('click', fetchCalendarEvents);
  }
}

function renderCalendarEvents() {
  calendarEventsList.innerHTML = '';
  calendarStatus.classList.add('hidden');
  calendarEventsList.classList.remove('hidden');

  if (calendarEvents.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'calendar-empty';
    emptyMsg.textContent = 'No events scheduled for today';
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

    if (event.location) {
      const locationDiv = document.createElement('div');
      locationDiv.className = 'calendar-event-location';
      locationDiv.textContent = event.location;
      li.appendChild(locationDiv);
    }

    calendarEventsList.appendChild(li);
  });

  renderSidebar();
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
