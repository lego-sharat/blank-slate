import { thoughts, saveThoughts, currentThoughtId, currentView } from '@/store/store';
import type { Thought, ThoughtStatus } from '@/types';

export const createThought = () => {
  const thought: Thought = {
    id: Date.now(),
    title: 'Untitled',
    content: '',
    status: 'draft',
    createdAt: Date.now(),
  };

  thoughts.value = [thought, ...thoughts.value];
  saveThoughts();
  currentThoughtId.value = thought.id;
  currentView.value = 'thought';
};

export const deleteThought = (id: number) => {
  thoughts.value = thoughts.value.filter(t => t.id !== id);
  saveThoughts();
  if (currentThoughtId.value === id) {
    currentThoughtId.value = null;
    currentView.value = 'glance';
  }
};

export const updateThoughtTitle = (id: number, title: string) => {
  const thought = thoughts.value.find(t => t.id === id);
  if (thought) {
    thought.title = title.trim() || 'Untitled';
    thought.updatedAt = Date.now();
    thoughts.value = [...thoughts.value];
    saveThoughts();
  }
};

export const updateThoughtContent = (id: number, content: string) => {
  const thought = thoughts.value.find(t => t.id === id);
  if (thought) {
    thought.content = content;
    thought.updatedAt = Date.now();
    thoughts.value = [...thoughts.value];
    saveThoughts();
  }
};

export const updateThoughtStatus = (id: number, status: ThoughtStatus) => {
  const thought = thoughts.value.find(t => t.id === id);
  if (thought) {
    thought.status = status;
    thought.updatedAt = Date.now();
    thoughts.value = [...thoughts.value];
    saveThoughts();
  }
};

export const openThought = (id: number) => {
  currentThoughtId.value = id;
  currentView.value = 'thought';
};

// Legacy aliases for backwards compatibility
export const createNote = createThought;
export const deleteNote = deleteThought;
export const updateNoteTitle = updateThoughtTitle;
export const updateNoteContent = updateThoughtContent;
export const openNote = openThought;
