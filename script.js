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
let copyButtonTimeout = null;

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
const todoInputActions = document.getElementById('todoInputActions');
const saveAddTodoBtn = document.getElementById('saveAddTodoBtn');
const cancelAddTodoBtn = document.getElementById('cancelAddTodoBtn');

// DOM elements - Notes
const noteTitleInput = document.getElementById('noteTitleInput');
const noteContentInput = document.getElementById('noteContentInput');
const notePreview = document.getElementById('notePreview');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');
const copyMarkdown = document.getElementById('copyMarkdown');
const exportToNotion = document.getElementById('exportToNotion');

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
  saveAddTodoBtn.addEventListener('click', addTodo);
  cancelAddTodoBtn.addEventListener('click', cancelAddTodo);

  todoInput.addEventListener('focus', () => {
    showAddTodoActions();
  });

  todoInput.addEventListener('blur', () => {
    // Delay hiding to allow button clicks to register
    setTimeout(() => {
      hideAddTodoActions();
    }, 150);
  });

  todoInput.addEventListener('input', () => {
    if (todoInput.value.trim() !== '') {
      showAddTodoActions();
    }
  });

  todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addTodo();
    }
  });

  todoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cancelAddTodo();
    }
  });

  // Notes
  deleteNoteBtn.addEventListener('click', confirmDeleteNote);
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

  // Enter key to focus on todo input when on todo page
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && currentView === 'todo') {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement.tagName === 'INPUT' ||
                            activeElement.tagName === 'TEXTAREA' ||
                            activeElement.tagName === 'BUTTON';

      if (!isInputFocused) {
        e.preventDefault();
        todoInput.focus();
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
  // Hide all views
  todoView.classList.add('hidden');
  noteView.classList.add('hidden');
  welcomeView.classList.add('hidden');

  // Show selected view
  if (view === 'todo') {
    todoView.classList.remove('hidden');
    // Hide note action buttons
    deleteNoteBtn.classList.add('hidden');
    copyMarkdown.classList.add('hidden');
    exportToNotion.classList.add('hidden');
  } else if (view === 'note') {
    noteView.classList.remove('hidden');
    // Show note action buttons (delete button visibility handled in showNoteView)
    copyMarkdown.classList.remove('hidden');
    exportToNotion.classList.remove('hidden');
  } else {
    welcomeView.classList.remove('hidden');
    // Hide note action buttons
    deleteNoteBtn.classList.add('hidden');
    copyMarkdown.classList.add('hidden');
    exportToNotion.classList.add('hidden');
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

  noteTitleInput.value = note.title || '';
  noteContentInput.value = note.content || '';

  noteContentInput.classList.remove('hidden');
  notePreview.classList.add('hidden');

  deleteNoteBtn.classList.remove('hidden');

  // Reset copy button state when switching notes
  resetCopyButton();

  showView('note');
  setTimeout(() => {
    autoResizeTitle();
    noteTitleInput.focus();
  }, 100);
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
    renderTodos();
  }
}

function saveTodos() {
  localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
  renderSidebar(); // Update TODO count in sidebar
}

function showAddTodoActions() {
  todoInputActions.classList.remove('hidden');
}

function hideAddTodoActions() {
  todoInputActions.classList.add('hidden');
}

function cancelAddTodo() {
  todoInput.value = '';
  hideAddTodoActions();
  todoInput.blur();
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
  hideAddTodoActions();
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

function editTodo(id, newText) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.text = newText;
    saveTodos();
    renderTodos();
  }
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
      enterEditMode(li, todo);
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
    todoList.appendChild(li);
  });
}

function enterEditMode(li, todo) {
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
    renderTodos();
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
      renderTodos();
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
        renderTodos();
      }
    }
  });

  // Cancel on Escape key
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      renderTodos();
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
      renderTodos();
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

    // Show TODO view after deleting
    showTodoView();
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
