/**
 * Storage manager for chrome.storage.local
 * Provides type-safe access to stored data
 */

import type { Todo, Thought, HistoryItem, CalendarEvent, LinearIssue, GitHubPR, MailMessage, Settings } from '@/types';

export const STORAGE_KEYS = {
  TODOS: 'todos',
  THOUGHTS: 'thoughts',
  HISTORY: 'history_items',
  CALENDAR_EVENTS: 'calendar_events',
  CALENDAR_TOKEN: 'calendar_token',
  LINEAR_ISSUES: 'linear_issues',
  GITHUB_PRS: 'github_prs',
  MAIL_MESSAGES: 'mail_messages',
  SETTINGS: 'settings',
  LAST_SYNC: 'last_sync',
  LAST_SUPABASE_SYNC: 'last_supabase_sync',
} as const;

/**
 * Get data from chrome.storage.local
 */
export async function getFromStorage<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const result = await chrome.storage.local.get(key);
    const value = result[key];
    if (value !== undefined && value !== null) {
      return value as T;
    }
    return defaultValue;
  } catch (error) {
    console.error(`Error getting ${key} from storage:`, error);
    return defaultValue;
  }
}

/**
 * Set data in chrome.storage.local
 */
export async function setInStorage(key: string, value: any): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    console.error(`Error setting ${key} in storage:`, error);
  }
}

/**
 * Remove data from chrome.storage.local
 */
export async function removeFromStorage(key: string): Promise<void> {
  try {
    await chrome.storage.local.remove(key);
  } catch (error) {
    console.error(`Error removing ${key} from storage:`, error);
  }
}

// Typed getters and setters

export async function getTodos(): Promise<Todo[]> {
  return getFromStorage<Todo[]>(STORAGE_KEYS.TODOS, []);
}

export async function setTodos(todos: Todo[]): Promise<void> {
  return setInStorage(STORAGE_KEYS.TODOS, todos);
}

export async function getThoughts(): Promise<Thought[]> {
  return getFromStorage<Thought[]>(STORAGE_KEYS.THOUGHTS, []);
}

export async function setThoughts(thoughts: Thought[]): Promise<void> {
  return setInStorage(STORAGE_KEYS.THOUGHTS, thoughts);
}

export async function getHistory(): Promise<HistoryItem[]> {
  return getFromStorage<HistoryItem[]>(STORAGE_KEYS.HISTORY, []);
}

export async function setHistory(history: HistoryItem[]): Promise<void> {
  return setInStorage(STORAGE_KEYS.HISTORY, history);
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  return getFromStorage<CalendarEvent[]>(STORAGE_KEYS.CALENDAR_EVENTS, []);
}

export async function setCalendarEvents(events: CalendarEvent[]): Promise<void> {
  return setInStorage(STORAGE_KEYS.CALENDAR_EVENTS, events);
}

export async function getCalendarToken(): Promise<string | null> {
  return getFromStorage<string | null>(STORAGE_KEYS.CALENDAR_TOKEN, null);
}

export async function setCalendarToken(token: string | null): Promise<void> {
  if (token) {
    return setInStorage(STORAGE_KEYS.CALENDAR_TOKEN, token);
  } else {
    return removeFromStorage(STORAGE_KEYS.CALENDAR_TOKEN);
  }
}

export async function getLinearIssues(): Promise<{
  assignedToMe: LinearIssue[];
  createdByMe: LinearIssue[];
  mentioningMe: LinearIssue[];
}> {
  return getFromStorage(STORAGE_KEYS.LINEAR_ISSUES, {
    assignedToMe: [],
    createdByMe: [],
    mentioningMe: [],
  });
}

export async function setLinearIssues(issues: {
  assignedToMe: LinearIssue[];
  createdByMe: LinearIssue[];
  mentioningMe: LinearIssue[];
}): Promise<void> {
  return setInStorage(STORAGE_KEYS.LINEAR_ISSUES, issues);
}

export async function getGitHubPRs(): Promise<{
  createdByMe: GitHubPR[];
  reviewRequested: GitHubPR[];
}> {
  return getFromStorage(STORAGE_KEYS.GITHUB_PRS, {
    createdByMe: [],
    reviewRequested: [],
  });
}

export async function setGitHubPRs(prs: {
  createdByMe: GitHubPR[];
  reviewRequested: GitHubPR[];
}): Promise<void> {
  return setInStorage(STORAGE_KEYS.GITHUB_PRS, prs);
}

export async function getMailMessages(): Promise<{
  all: MailMessage[];
  onboarding: MailMessage[];
  support: MailMessage[];
}> {
  return getFromStorage(STORAGE_KEYS.MAIL_MESSAGES, {
    all: [],
    onboarding: [],
    support: [],
  });
}

export async function setMailMessages(messages: {
  all: MailMessage[];
  onboarding: MailMessage[];
  support: MailMessage[];
}): Promise<void> {
  return setInStorage(STORAGE_KEYS.MAIL_MESSAGES, messages);
}

export async function getSettings(): Promise<Partial<Settings>> {
  return getFromStorage<Partial<Settings>>(STORAGE_KEYS.SETTINGS, {});
}

export async function setSettings(settings: Partial<Settings>): Promise<void> {
  return setInStorage(STORAGE_KEYS.SETTINGS, settings);
}

export async function getLastSync(): Promise<number> {
  return getFromStorage<number>(STORAGE_KEYS.LAST_SYNC, 0);
}

export async function setLastSync(timestamp: number): Promise<void> {
  return setInStorage(STORAGE_KEYS.LAST_SYNC, timestamp);
}

export async function getLastSupabaseSync(): Promise<number> {
  return getFromStorage<number>(STORAGE_KEYS.LAST_SUPABASE_SYNC, 0);
}

export async function setLastSupabaseSync(timestamp: number): Promise<void> {
  return setInStorage(STORAGE_KEYS.LAST_SUPABASE_SYNC, timestamp);
}
