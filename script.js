// Storage keys
const TODOS_KEY = 'minimal_newtab_todos';
const NOTES_KEY = 'minimal_newtab_notes';

// State
let todos = [];

// DOM elements
const todoInput = document.getElementById('todoInput');
const addTodoBtn = document.getElementById('addTodoBtn');
const todoList = document.getElementById('todoList');
const notesArea = document.getElementById('notesArea');
const timeDisplay = document.getElementById('timeDisplay');
const dateDisplay = document.getElementById('dateDisplay');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadTodos();
  loadNotes();
  setupEventListeners();
  updateClock();
  setInterval(updateClock, 1000);
});

// Setup event listeners
function setupEventListeners() {
  addTodoBtn.addEventListener('click', addTodo);
  todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addTodo();
    }
  });

  notesArea.addEventListener('input', saveNotes);
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
    notesArea.value = stored;
  }
}

function saveNotes() {
  localStorage.setItem(NOTES_KEY, notesArea.value);
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
