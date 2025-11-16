import type { LinearIssue } from '../types';
import { settings } from '../store/store';

const LINEAR_API_URL = 'https://api.linear.app/graphql';
const STORAGE_KEY = 'minimal_newtab_linear_issues';

export interface LinearIssuesResponse {
  assignedToMe: LinearIssue[];
  createdByMe: LinearIssue[];
  mentioningMe: LinearIssue[];
}

/**
 * Get Linear API key from settings
 */
export function getLinearApiKey(): string | null {
  return settings.value.linearApiKey || null;
}

/**
 * Check if Linear is connected
 */
export function isLinearConnected(): boolean {
  const apiKey = getLinearApiKey();
  return !!apiKey && apiKey.trim().length > 0;
}

/**
 * Make a GraphQL request to Linear API
 */
async function linearGraphQLRequest(query: string, variables: Record<string, any> = {}, apiKey?: string): Promise<any> {
  let key: string | null;
  if (apiKey !== undefined) {
    key = apiKey;
  } else {
    key = getLinearApiKey();
  }

  if (!key) {
    throw new Error('Linear API key not configured');
  }

  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': key,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`Linear API error: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`Linear GraphQL error: ${data.errors[0]?.message || 'Unknown error'}`);
  }

  return data.data;
}

/**
 * Transform Linear API issue to our LinearIssue type
 */
function transformLinearIssue(issue: any): LinearIssue {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    url: issue.url,
    state: {
      id: issue.state.id,
      name: issue.state.name,
      color: issue.state.color,
      type: issue.state.type,
    },
    priority: issue.priority,
    assignee: issue.assignee ? {
      id: issue.assignee.id,
      name: issue.assignee.name,
      email: issue.assignee.email,
      avatarUrl: issue.assignee.avatarUrl,
    } : undefined,
    creator: {
      id: issue.creator.id,
      name: issue.creator.name,
      email: issue.creator.email,
      avatarUrl: issue.creator.avatarUrl,
    },
    project: issue.project ? {
      id: issue.project.id,
      name: issue.project.name,
      color: issue.project.color,
    } : undefined,
    team: {
      id: issue.team.id,
      name: issue.team.name,
      key: issue.team.key,
    },
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    dueDate: issue.dueDate,
    labels: issue.labels?.nodes?.map((label: any) => ({
      id: label.id,
      name: label.name,
      color: label.color,
    })) || [],
    lastComment: issue.comments?.nodes?.[0] ? {
      id: issue.comments.nodes[0].id,
      body: issue.comments.nodes[0].body,
      createdAt: issue.comments.nodes[0].createdAt,
      user: {
        name: issue.comments.nodes[0].user.name,
        avatarUrl: issue.comments.nodes[0].user.avatarUrl,
      },
    } : undefined,
  };
}

/**
 * GraphQL query for fetching issues assigned to the current user
 */
const ASSIGNED_TO_ME_QUERY = `
  query AssignedToMe {
    viewer {
      id
      assignedIssues(
        filter: {
          state: { type: { nin: ["completed", "canceled"] } }
        }
        orderBy: createdAt
        first: 10
      ) {
        nodes {
          id
          identifier
          title
          description
          url
          priority
          createdAt
          updatedAt
          dueDate
          state {
            id
            name
            color
            type
          }
          assignee {
            id
            name
            email
            avatarUrl
          }
          creator {
            id
            name
            email
            avatarUrl
          }
          project {
            id
            name
            color
          }
          team {
            id
            name
            key
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          comments(last: 1) {
            nodes {
              id
              body
              createdAt
              user {
                name
                avatarUrl
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL query for fetching issues created by the current user
 */
const CREATED_BY_ME_QUERY = `
  query CreatedByMe {
    viewer {
      id
      createdIssues(
        filter: {
          state: { type: { nin: ["completed", "canceled"] } }
        }
        orderBy: createdAt
        first: 10
      ) {
        nodes {
          id
          identifier
          title
          description
          url
          priority
          createdAt
          updatedAt
          dueDate
          state {
            id
            name
            color
            type
          }
          assignee {
            id
            name
            email
            avatarUrl
          }
          creator {
            id
            name
            email
            avatarUrl
          }
          project {
            id
            name
            color
          }
          team {
            id
            name
            key
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          comments(last: 1) {
            nodes {
              id
              body
              createdAt
              user {
                name
                avatarUrl
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL query for fetching the current user info and issues mentioning them
 */
const MENTIONING_ME_QUERY = `
  query MentioningMe($userId: ID!) {
    issues(
      filter: {
        subscribers: { id: { eq: $userId } }
        state: { type: { nin: ["completed", "canceled"] } }
      }
      orderBy: updatedAt
      first: 10
    ) {
      nodes {
        id
        identifier
        title
        description
        url
        priority
        createdAt
        updatedAt
        dueDate
        state {
          id
          name
          color
          type
        }
        assignee {
          id
          name
          email
          avatarUrl
        }
        creator {
          id
          name
          email
          avatarUrl
        }
        project {
          id
          name
          color
        }
        team {
          id
          name
          key
        }
        labels {
          nodes {
            id
            name
            color
          }
        }
        comments(last: 1) {
          nodes {
            id
            body
            createdAt
            user {
              name
              avatarUrl
            }
          }
        }
      }
    }
  }
`;

/**
 * Get current user ID from Linear
 */
async function getLinearUserId(apiKey?: string): Promise<string> {
  const query = `
    query Me {
      viewer {
        id
      }
    }
  `;

  const data = await linearGraphQLRequest(query, {}, apiKey);
  return data.viewer.id;
}

/**
 * Fetch issues assigned to the current user
 */
export async function fetchAssignedToMeIssues(apiKey?: string): Promise<LinearIssue[]> {
  try {
    const data = await linearGraphQLRequest(ASSIGNED_TO_ME_QUERY, {}, apiKey);
    const issues = data.viewer.assignedIssues.nodes;
    return issues.map(transformLinearIssue);
  } catch (error) {
    console.error('Error fetching assigned issues:', error);
    throw error;
  }
}

/**
 * Fetch issues created by the current user
 */
export async function fetchCreatedByMeIssues(apiKey?: string): Promise<LinearIssue[]> {
  try {
    const data = await linearGraphQLRequest(CREATED_BY_ME_QUERY, {}, apiKey);
    const issues = data.viewer.createdIssues.nodes;
    return issues.map(transformLinearIssue);
  } catch (error) {
    console.error('Error fetching created issues:', error);
    throw error;
  }
}

/**
 * Fetch issues mentioning the current user (subscribed issues)
 */
export async function fetchMentioningMeIssues(apiKey?: string): Promise<LinearIssue[]> {
  try {
    const userId = await getLinearUserId(apiKey);
    const data = await linearGraphQLRequest(MENTIONING_ME_QUERY, { userId }, apiKey);
    const issues = data.issues.nodes;
    return issues.map(transformLinearIssue);
  } catch (error) {
    console.error('Error fetching mentioning issues:', error);
    throw error;
  }
}

/**
 * Fetch all Linear issues (assigned, created, mentioning)
 */
export async function fetchAllLinearIssues(apiKey?: string): Promise<LinearIssuesResponse> {
  // Check connection - use apiKey if provided, otherwise check signal
  let key: string | null;
  if (apiKey !== undefined) {
    key = apiKey;
  } else {
    key = getLinearApiKey();
  }

  if (!key || key.trim().length === 0) {
    console.log('Linear not connected, skipping fetch');
    return {
      assignedToMe: [],
      createdByMe: [],
      mentioningMe: [],
    };
  }

  try {
    const [assignedToMe, createdByMe, mentioningMe] = await Promise.all([
      fetchAssignedToMeIssues(apiKey),
      fetchCreatedByMeIssues(apiKey),
      fetchMentioningMeIssues(apiKey),
    ]);

    const result = {
      assignedToMe,
      createdByMe,
      mentioningMe,
    };

    // NOTE: Caching is handled by background script via chrome.storage
    // Don't use localStorage here as it's not available in background workers

    return result;
  } catch (error) {
    console.error('Error fetching Linear issues:', error);
    // Return empty data on error (background script will cache last successful fetch)
    return {
      assignedToMe: [],
      createdByMe: [],
      mentioningMe: [],
    };
  }
}

/**
 * Save Linear issues to local storage
 * @deprecated Use chrome.storage via storageManager instead
 * Only works in frontend (not background workers)
 */
export function saveLinearIssuesToStorage(issues: LinearIssuesResponse): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    // Not available in background workers
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
  } catch (error) {
    console.error('Error saving Linear issues to storage:', error);
  }
}

/**
 * Load Linear issues from local storage
 * @deprecated Use chrome.storage via storageManager instead
 * Only works in frontend (not background workers)
 */
export function loadLinearIssuesFromStorage(): LinearIssuesResponse {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    // Not available in background workers
    return {
      assignedToMe: [],
      createdByMe: [],
      mentioningMe: [],
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading Linear issues from storage:', error);
  }

  return {
    assignedToMe: [],
    createdByMe: [],
    mentioningMe: [],
  };
}

/**
 * Start auto-sync for Linear issues
 */
export function startLinearSync(intervalMinutes: number = 15): number {
  // Initial fetch
  fetchAllLinearIssues().catch(console.error);

  // Set up interval
  return setInterval(() => {
    if (isLinearConnected()) {
      fetchAllLinearIssues().catch(console.error);
    }
  }, intervalMinutes * 60 * 1000) as unknown as number;
}

/**
 * Get priority label
 */
export function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 0: return 'No priority';
    case 1: return 'Urgent';
    case 2: return 'High';
    case 3: return 'Medium';
    case 4: return 'Low';
    default: return 'No priority';
  }
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: number): string {
  switch (priority) {
    case 1: return '#f87171'; // red
    case 2: return '#fb923c'; // orange
    case 3: return '#fbbf24'; // yellow
    case 4: return '#60a5fa'; // blue
    default: return '#9ca3af'; // gray
  }
}
