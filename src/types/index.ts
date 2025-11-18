// Todo types
export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: number;
}

// Thought types
export type ThoughtStatus = 'draft' | 'ready';

export interface Thought {
  id: number;
  title: string;
  content: string;
  status: ThoughtStatus;
  createdAt: number;
  updatedAt?: number;
}

// Reading list types
export type ReadingStatus = 'unread' | 'read';

export interface ReadingItem {
  id: number;
  title: string;
  url?: string;
  status: ReadingStatus;
  createdAt: number;
  readAt?: number;
}

// Calendar types
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  htmlLink?: string;
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      uri: string;
      entryPointType: string;
    }>;
  };
}

// Settings types
export interface Settings {
  notionApiKey: string;
  notionDatabaseId: string;
  fontStyle: 'mono' | 'handwriting';
  googleClientId: string;
  supabaseUrl: string;
  supabaseKey: string;
  theme: 'dark' | 'light';
  linearApiKey: string;
  githubToken: string;
  figmaApiKey: string;
}

// Linear types
export interface LinearIssue {
  id: string;
  identifier: string; // e.g., "PRD-123"
  title: string;
  description?: string;
  url: string;
  state: {
    id: string;
    name: string;
    color: string;
    type: string; // "started", "completed", "canceled", "backlog", "unstarted"
  };
  priority: number; // 0 (No priority) to 4 (Urgent)
  assignee?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  creator: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  project?: {
    id: string;
    name: string;
    color: string;
  };
  team: {
    id: string;
    name: string;
    key: string;
  };
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  labels?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  lastComment?: {
    id: string;
    body: string;
    createdAt: string;
    user: {
      name: string;
      avatarUrl?: string;
    };
  };
}

// GitHub types
export interface GitHubPR {
  id: string;
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  closedAt?: string;
  author: {
    login: string;
    avatarUrl: string;
  };
  repository: {
    name: string;
    nameWithOwner: string;
    url: string;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
  reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED';
  additions: number;
  deletions: number;
  changedFiles: number;
}

// History types
export type HistoryItemType = 'google-docs' | 'notion' | 'figma' | 'figjam' | 'github-repo' | 'github-issue';

export interface HistoryItem {
  id: string;
  type: HistoryItemType;
  title: string;
  url: string;
  visitedAt: number;
  favicon?: string;
}

// View types
export type ViewType = 'glance' | 'today' | 'planner' | 'thought' | 'thoughts' | 'tasks' | 'linear' | 'github' | 'history' | 'profile' | 'settings';

// Sidebar section types
export interface SidebarSection {
  id: string;
  title: string;
  icon?: string;
  collapsed: boolean;
  items: SidebarItem[];
}

export interface SidebarItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
  onClick: () => void;
}
