import { todos, saveTodos } from '@/store/store';
import type { Todo } from '@/types';

export const addTodo = (text: string) => {
  if (!text.trim()) return;

  const todo: Todo = {
    id: Date.now(),
    text: text.trim(),
    completed: false,
    createdAt: Date.now(),
  };

  todos.value = [...todos.value, todo];
  saveTodos();
};

export const toggleTodo = (id: number) => {
  const todo = todos.value.find(t => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    todos.value = [...todos.value];
    saveTodos();
  }
};

export const deleteTodo = (id: number) => {
  todos.value = todos.value.filter(t => t.id !== id);
  saveTodos();
};

export const updateTodoText = (id: number, text: string) => {
  const todo = todos.value.find(t => t.id === id);
  if (todo) {
    todo.text = text.trim();
    todos.value = [...todos.value];
    saveTodos();
  }
};

export const reorderTodos = (fromIndex: number, toIndex: number) => {
  const newTodos = [...todos.value];
  const [removed] = newTodos.splice(fromIndex, 1);
  newTodos.splice(toIndex, 0, removed);
  todos.value = newTodos;
  saveTodos();
};
