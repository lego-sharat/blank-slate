import { notes, saveNotes, currentNoteId, currentView } from '@/store/store';
import type { Note, NoteStatus } from '@/types';

export const createNote = () => {
  const note: Note = {
    id: Date.now(),
    title: 'Untitled',
    content: '',
    status: 'draft',
    createdAt: Date.now(),
  };

  notes.value = [note, ...notes.value];
  saveNotes();
  currentNoteId.value = note.id;
  currentView.value = 'note';
};

export const deleteNote = (id: number) => {
  notes.value = notes.value.filter(n => n.id !== id);
  saveNotes();
  if (currentNoteId.value === id) {
    currentNoteId.value = null;
    currentView.value = 'glance';
  }
};

export const updateNoteTitle = (id: number, title: string) => {
  const note = notes.value.find(n => n.id === id);
  if (note) {
    note.title = title.trim() || 'Untitled';
    note.updatedAt = Date.now();
    notes.value = [...notes.value];
    saveNotes();
  }
};

export const updateNoteContent = (id: number, content: string) => {
  const note = notes.value.find(n => n.id === id);
  if (note) {
    note.content = content;
    note.updatedAt = Date.now();
    notes.value = [...notes.value];
    saveNotes();
  }
};

export const updateNoteStatus = (id: number, status: NoteStatus) => {
  const note = notes.value.find(n => n.id === id);
  if (note) {
    note.status = status;
    note.updatedAt = Date.now();
    notes.value = [...notes.value];
    saveNotes();
  }
};

export const openNote = (id: number) => {
  currentNoteId.value = id;
  currentView.value = 'note';
};
