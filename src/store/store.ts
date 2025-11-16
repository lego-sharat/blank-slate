import { signal, computed } from '@preact/signals';
import type { Todo, Note, ReadingItem, CalendarEvent, Settings, ViewType, LinearIssue } from '@/types';

// Storage keys
export const STORAGE_KEYS = {
  TODOS: 'minimal_newtab_todos',
  NOTES: 'minimal_newtab_notes',
  READING_LIST: 'minimal_newtab_reading_list',
  SETTINGS: 'minimal_newtab_settings',
  CALENDAR_TOKEN: 'minimal_newtab_calendar_token',
  CALENDAR_EVENTS: 'minimal_newtab_calendar_events',
  LINEAR_ISSUES: 'minimal_newtab_linear_issues',
} as const;

// Core signals
export const todos = signal<Todo[]>([]);
export const notes = signal<Note[]>([]);
export const readingList = signal<ReadingItem[]>([]);
export const calendarEvents = signal<CalendarEvent[]>([]);
export const linearIssues = signal<{
  assignedToMe: LinearIssue[];
  createdByMe: LinearIssue[];
  mentioningMe: LinearIssue[];
}>({
  assignedToMe: [],
  createdByMe: [],
  mentioningMe: [],
});
export const settings = signal<Settings>({
  notionApiKey: '',
  notionDatabaseId: '',
  fontStyle: 'mono',
  googleClientId: '',
  supabaseUrl: '',
  supabaseKey: '',
  theme: 'dark',
  linearApiKey: '',
});

// UI state signals
export const currentView = signal<ViewType>('glance');
export const currentNoteId = signal<number | null>(null);
export const isPreviewMode = signal<boolean>(false);
export const sidebarCollapsed = signal<boolean>(false);

// Auth state signals
export const currentUser = signal<any>(null);
export const isAuthenticated = signal<boolean>(false);
export const calendarToken = signal<string | null>(null);

// Computed signals
export const currentNote = computed(() => {
  const noteId = currentNoteId.value;
  if (!noteId) return null;
  return notes.value.find(note => note.id === noteId) || null;
});

export const incompleteTodos = computed(() => {
  return todos.value.filter(todo => !todo.completed);
});

export const completedTodos = computed(() => {
  return todos.value.filter(todo => todo.completed);
});

export const draftNotes = computed(() => {
  return notes.value.filter(note => note.status === 'draft');
});

export const readyNotes = computed(() => {
  return notes.value.filter(note => note.status === 'ready');
});

export const unreadItems = computed(() => {
  return readingList.value.filter(item => item.status === 'unread');
});

export const readItems = computed(() => {
  return readingList.value.filter(item => item.status === 'read');
});

// Today's calendar events (sorted by start time)
export const todayEvents = computed(() => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  return calendarEvents.value
    .filter(event => {
      const eventStart = new Date(event.start.dateTime || event.start.date || '');
      return eventStart >= todayStart && eventStart < todayEnd;
    })
    .sort((a, b) => {
      const aStart = new Date(a.start.dateTime || a.start.date || '').getTime();
      const bStart = new Date(b.start.dateTime || b.start.date || '').getTime();
      return aStart - bStart;
    });
});

// Next upcoming event
export const nextEvent = computed(() => {
  const now = new Date();
  const upcoming = todayEvents.value.filter(event => {
    const eventStart = new Date(event.start.dateTime || event.start.date || '');
    return eventStart > now;
  });
  return upcoming[0] || null;
});

// Linear computed signals
export const assignedLinearIssues = computed(() => {
  return linearIssues.value.assignedToMe;
});

export const createdLinearIssues = computed(() => {
  return linearIssues.value.createdByMe;
});

export const mentioningLinearIssues = computed(() => {
  return linearIssues.value.mentioningMe;
});

export const allLinearIssues = computed(() => {
  return [
    ...linearIssues.value.assignedToMe,
    ...linearIssues.value.createdByMe,
    ...linearIssues.value.mentioningMe,
  ];
});

// Load configuration and cached data from localStorage
// Note: Tasks and notes are loaded via dataSync.syncAllData()
export const loadFromStorage = () => {
  try {
    const storedReadingList = localStorage.getItem(STORAGE_KEYS.READING_LIST);
    if (storedReadingList) readingList.value = JSON.parse(storedReadingList);

    const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (storedSettings) settings.value = { ...settings.value, ...JSON.parse(storedSettings) };

    // Load Linear API key separately for backwards compatibility
    const linearApiKey = localStorage.getItem('linear_api_key');
    if (linearApiKey) {
      settings.value = { ...settings.value, linearApiKey };
    }

    const storedCalendarEvents = localStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS);
    if (storedCalendarEvents) calendarEvents.value = JSON.parse(storedCalendarEvents);

    const storedCalendarToken = localStorage.getItem(STORAGE_KEYS.CALENDAR_TOKEN);
    if (storedCalendarToken) calendarToken.value = storedCalendarToken;

    const storedLinearIssues = localStorage.getItem(STORAGE_KEYS.LINEAR_ISSUES);
    if (storedLinearIssues) linearIssues.value = JSON.parse(storedLinearIssues);
  } catch (error) {
    console.error('Error loading from storage:', error);
  }
};

// Save data to localStorage
export const saveTodos = () => {
  localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(todos.value));
};

export const saveNotes = () => {
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes.value));
};

export const saveReadingList = () => {
  localStorage.setItem(STORAGE_KEYS.READING_LIST, JSON.stringify(readingList.value));
};

export const saveSettings = () => {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings.value));
};

export const saveCalendarEvents = () => {
  localStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(calendarEvents.value));
};

export const saveCalendarToken = () => {
  if (calendarToken.value) {
    localStorage.setItem(STORAGE_KEYS.CALENDAR_TOKEN, calendarToken.value);
  } else {
    localStorage.removeItem(STORAGE_KEYS.CALENDAR_TOKEN);
  }
};

export const saveLinearIssues = () => {
  localStorage.setItem(STORAGE_KEYS.LINEAR_ISSUES, JSON.stringify(linearIssues.value));
};
