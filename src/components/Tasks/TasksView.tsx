import { useSignal, useComputed } from '@preact/signals';
import { todos } from '@/store/store';
import { addTodo, toggleTodo, deleteTodo, updateTodoText, reorderTodos } from '@/utils/todoActions';
import type { Todo } from '@/types';

type FilterType = 'all' | 'active' | 'completed';

export default function TasksView() {
  const newTaskText = useSignal('');
  const filter = useSignal<FilterType>('all');
  const editingId = useSignal<number | null>(null);
  const editText = useSignal('');
  const draggedIndex = useSignal<number | null>(null);
  const dragOverIndex = useSignal<number | null>(null);

  const filteredTodos = useComputed(() => {
    const allTodos = todos.value;
    switch (filter.value) {
      case 'active':
        return allTodos.filter(t => !t.completed);
      case 'completed':
        return allTodos.filter(t => t.completed);
      default:
        return allTodos;
    }
  });

  const activeTodoCount = useComputed(() => {
    return todos.value.filter(t => !t.completed).length;
  });

  const handleAddTask = (e: Event) => {
    e.preventDefault();
    if (newTaskText.value.trim()) {
      addTodo(newTaskText.value);
      newTaskText.value = '';
    }
  };

  const handleStartEdit = (todo: Todo) => {
    editingId.value = todo.id;
    editText.value = todo.text;
  };

  const handleSaveEdit = (id: number) => {
    if (editText.value.trim()) {
      updateTodoText(id, editText.value);
    }
    editingId.value = null;
    editText.value = '';
  };

  const handleCancelEdit = () => {
    editingId.value = null;
    editText.value = '';
  };

  const handleKeyDown = (e: KeyboardEvent, id: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(id);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDragStart = (index: number) => {
    draggedIndex.value = index;
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault(); // Allow drop
    if (draggedIndex.value !== null && draggedIndex.value !== index) {
      dragOverIndex.value = index;
    }
  };

  const handleDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex.value !== null && draggedIndex.value !== dropIndex) {
      // Find actual indices in the full todos array
      const draggedTodo = filteredTodos.value[draggedIndex.value];
      const dropTodo = filteredTodos.value[dropIndex];
      const fromIndex = todos.value.findIndex(t => t.id === draggedTodo.id);
      const toIndex = todos.value.findIndex(t => t.id === dropTodo.id);
      reorderTodos(fromIndex, toIndex);
    }
    draggedIndex.value = null;
    dragOverIndex.value = null;
  };

  const handleDragEnd = () => {
    draggedIndex.value = null;
    dragOverIndex.value = null;
  };

  const hasNoTasks = todos.value.length === 0;

  const addTaskForm = (
    <form class="task-add-form" onSubmit={handleAddTask}>
      <input
        type="text"
        class="task-add-input"
        placeholder="Add a task..."
        value={newTaskText.value}
        onInput={(e) => newTaskText.value = (e.target as HTMLInputElement).value}
      />
      <button type="submit" class="task-add-button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </form>
  );

  return (
    <div class="tasks-view">
      <div class="tasks-header">
        <h1 class="tasks-title">Tasks</h1>
        <div class="tasks-stats">
          {activeTodoCount.value} {activeTodoCount.value === 1 ? 'task' : 'tasks'}
        </div>
      </div>

      {hasNoTasks && addTaskForm}

      {!hasNoTasks && (
        <div class="tasks-filters">
          <button
            class={`filter-btn ${filter.value === 'all' ? 'active' : ''}`}
            onClick={() => filter.value = 'all'}
          >
            All
          </button>
          <button
            class={`filter-btn ${filter.value === 'active' ? 'active' : ''}`}
            onClick={() => filter.value = 'active'}
          >
            Active
          </button>
          <button
            class={`filter-btn ${filter.value === 'completed' ? 'active' : ''}`}
            onClick={() => filter.value = 'completed'}
          >
            Completed
          </button>
        </div>
      )}

      <div class="tasks-list">
        {filteredTodos.value.length === 0 ? (
          <div class="tasks-empty">
            {filter.value === 'active' && 'No active tasks'}
            {filter.value === 'completed' && 'No completed tasks'}
            {filter.value === 'all' && hasNoTasks && 'No tasks yet'}
          </div>
        ) : (
          filteredTodos.value.map((todo, index) => (
            <div
              key={todo.id}
              class={`task-item ${todo.completed ? 'completed' : ''} ${draggedIndex.value === index ? 'dragging' : ''} ${dragOverIndex.value === index && draggedIndex.value !== index ? 'drop-target' : ''}`}
              draggable={!editingId.value}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div
                class="task-drag-handle"
                title="Drag to reorder"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="4" y1="8" x2="20" y2="8"/>
                  <line x1="4" y1="16" x2="20" y2="16"/>
                </svg>
              </div>

              <label class="task-checkbox-wrapper">
                <input
                  type="checkbox"
                  class="task-checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id)}
                />
                <span class="task-checkbox-custom"></span>
              </label>

              {editingId.value === todo.id ? (
                <input
                  type="text"
                  class="task-edit-input"
                  value={editText.value}
                  onInput={(e) => editText.value = (e.target as HTMLInputElement).value}
                  onBlur={() => handleSaveEdit(todo.id)}
                  onKeyDown={(e) => handleKeyDown(e, todo.id)}
                  autoFocus
                />
              ) : (
                <span
                  class="task-text"
                  onClick={() => handleStartEdit(todo)}
                >
                  {todo.text}
                </span>
              )}

              <button
                class="task-delete-btn"
                onClick={() => deleteTodo(todo.id)}
                title="Delete task"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {!hasNoTasks && addTaskForm}
    </div>
  );
}
