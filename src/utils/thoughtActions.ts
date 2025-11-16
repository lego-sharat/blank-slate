import { thoughts, saveThoughts, currentThoughtId, currentView } from '@/store/store';
import type { Thought, ThoughtStatus } from '@/types';

export const createNote = () => {
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

export const deleteNote = (id: number) => {
  thoughts.value = thoughts.value.filter(n => n.id !== id);
  saveThoughts();
  if (currentThoughtId.value === id) {
    currentThoughtId.value = null;
    currentView.value = 'glance';
  }
};

export const updateNoteTitle = (id: number, title: string) => {
  const thought = thoughts.value.find(n => n.id === id);
  if (thought) {
    thought.title = title.trim() || 'Untitled';
    thought.updatedAt = Date.now();
    thoughts.value = [...thoughts.value];
    saveThoughts();
  }
};

export const updateNoteContent = (id: number, content: string) => {
  const thought = thoughts.value.find(n => n.id === id);
  if (thought) {
    thought.content = content;
    thought.updatedAt = Date.now();
    thoughts.value = [...thoughts.value];
    saveThoughts();
  }
};

export const updateThoughtStatus = (id: number, status: ThoughtStatus) => {
  const thought = thoughts.value.find(n => n.id === id);
  if (thought) {
    thought.status = status;
    thought.updatedAt = Date.now();
    thoughts.value = [...thoughts.value];
    saveThoughts();
  }
};

export const openNote = (id: number) => {
  currentThoughtId.value = id;
  currentView.value = 'thought';
};
