// Todo types
export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: number;
}

// Note types
export type NoteStatus = 'draft' | 'ready';

export interface Note {
  id: number;
  title: string;
  content: string;
  status: NoteStatus;
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
}

// View types
export type ViewType = 'glance' | 'today' | 'planner' | 'note' | 'notes' | 'tasks' | 'linear' | 'profile' | 'settings';

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
