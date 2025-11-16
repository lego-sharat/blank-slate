import { signal, computed } from '@preact/signals';
import type { Todo, Thought, ReadingItem, CalendarEvent, Settings, ViewType, LinearIssue, GitHubPR } from '@/types';
import {
  setTodos as saveToStorage_Todos,
  setThoughts as saveToStorage_Notes,
  setSettings as saveToStorage_Settings,
  setCalendarToken as saveToStorage_CalendarToken,
} from '@/utils/storageManager';

// Storage keys (kept for backwards compatibility)
export const STORAGE_KEYS = {
  TODOS: 'todos',
  THOUGHTS: 'thoughts',
  READING_LIST: 'reading_list',
  SETTINGS: 'settings',
  CALENDAR_TOKEN: 'calendar_token',
  CALENDAR_EVENTS: 'calendar_events',
  LINEAR_ISSUES: 'linear_issues',
  GITHUB_PRS: 'github_prs',
} as const;

// Core signals
export const todos = signal<Todo[]>([]);
export const thoughts = signal<Thought[]>([]);
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
export const githubPRs = signal<{
  createdByMe: GitHubPR[];
  reviewRequested: GitHubPR[];
}>({
  createdByMe: [],
  reviewRequested: [],
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
  githubToken: '',
});

// UI state signals
export const currentView = signal<ViewType>('glance');
export const currentThoughtId = signal<number | null>(null);
export const isPreviewMode = signal<boolean>(false);
export const sidebarCollapsed = signal<boolean>(false);

// Auth state signals
export const currentUser = signal<any>(null);
export const isAuthenticated = signal<boolean>(false);
export const calendarToken = signal<string | null>(null);

// Computed signals
export const currentThought = computed(() => {
  const noteId = currentThoughtId.value;
  if (!noteId) return null;
  return thoughts.value.find(thought => thought.id === noteId) || null;
});

export const incompleteTodos = computed(() => {
  return todos.value.filter(todo => !todo.completed);
});

export const completedTodos = computed(() => {
  return todos.value.filter(todo => todo.completed);
});

export const draftThoughts = computed(() => {
  return thoughts.value.filter(thought => thought.status === 'draft');
});

export const readyThoughts = computed(() => {
  return thoughts.value.filter(thought => thought.status === 'ready');
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

// GitHub computed signals
export const createdGitHubPRs = computed(() => {
  return githubPRs.value.createdByMe;
});

export const reviewRequestedGitHubPRs = computed(() => {
  return githubPRs.value.reviewRequested;
});

export const allGitHubPRs = computed(() => {
  return [
    ...githubPRs.value.createdByMe,
    ...githubPRs.value.reviewRequested,
  ];
});

// Load configuration and cached data from chrome.storage
// Thought: All data is now loaded via dataSync.syncAllData()
export const loadFromStorage = async () => {
  try {
    // Load reading list from localStorage (not migrated to chrome.storage yet)
    const storedReadingList = localStorage.getItem('reading_list');
    if (storedReadingList) readingList.value = JSON.parse(storedReadingList);

    // Load settings from chrome.storage
    const { getSettings } = await import('@/utils/storageManager');
    const storedSettings = await getSettings();
    if (storedSettings) {
      settings.value = { ...settings.value, ...storedSettings };
    }

    // Load Linear API key from localStorage for backwards compatibility
    const linearApiKey = localStorage.getItem('linear_api_key');
    if (linearApiKey && !settings.value.linearApiKey) {
      settings.value = { ...settings.value, linearApiKey };
      await saveSettings();
    }

    // Load GitHub token from localStorage for backwards compatibility
    const githubToken = localStorage.getItem('github_token');
    if (githubToken && !settings.value.githubToken) {
      settings.value = { ...settings.value, githubToken };
      await saveSettings();
    }
  } catch (error) {
    console.error('Error loading from storage:', error);
  }
};

// Save data to chrome.storage
export const saveTodos = async () => {
  await saveToStorage_Todos(todos.value);
};

export const saveThoughts = async () => {
  await saveToStorage_Notes(thoughts.value);
};

export const saveReadingList = () => {
  // Still using localStorage for reading list
  localStorage.setItem('reading_list', JSON.stringify(readingList.value));
};

export const saveSettings = async () => {
  await saveToStorage_Settings(settings.value);
};

export const saveCalendarEvents = () => {
  // Calendar events are managed by background script
  console.log('Calendar events are managed by background script');
};

export const saveCalendarToken = async () => {
  await saveToStorage_CalendarToken(calendarToken.value);
};

export const saveLinearIssues = () => {
  // Linear issues are managed by background script
  console.log('Linear issues are managed by background script');
};

export const saveGitHubPRs = () => {
  // GitHub PRs are managed by background script
  console.log('GitHub PRs are managed by background script');
};
