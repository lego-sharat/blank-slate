import type { GitHubPR } from '@/types';

/**
 * GitHub GraphQL API endpoint
 */
const GITHUB_API_URL = 'https://api.github.com/graphql';

/**
 * GraphQL query for fetching PRs created by the current user
 */
const CREATED_BY_ME_QUERY = `
  query CreatedByMe {
    viewer {
      login
      pullRequests(first: 10, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {
        nodes {
          id
          number
          title
          url
          state
          isDraft
          createdAt
          updatedAt
          mergedAt
          closedAt
          author {
            login
            avatarUrl
          }
          repository {
            name
            nameWithOwner
            url
          }
          labels(first: 5) {
            nodes {
              name
              color
            }
          }
          reviewDecision
          additions
          deletions
          changedFiles
        }
      }
    }
  }
`;

/**
 * GraphQL query for fetching PRs assigned to the current user for review
 * Thought: The search query is built dynamically with the username
 */
const buildReviewRequestedQuery = (username: string) => `
  query ReviewRequested {
    search(query: "is:pr is:open review-requested:${username}", type: ISSUE, first: 10) {
      nodes {
        ... on PullRequest {
          id
          number
          title
          url
          state
          isDraft
          createdAt
          updatedAt
          mergedAt
          closedAt
          author {
            login
            avatarUrl
          }
          repository {
            name
            nameWithOwner
            url
          }
          labels(first: 5) {
            nodes {
              name
              color
            }
          }
          reviewDecision
          additions
          deletions
          changedFiles
        }
      }
    }
  }
`;

/**
 * Fetches data from GitHub GraphQL API
 */
async function fetchGitHubGraphQL(query: string, variables: Record<string, unknown> = {}, token: string): Promise<unknown> {
  const response = await fetch(GITHUB_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

/**
 * Fetches pull requests created by the current user
 */
export async function fetchCreatedByMe(token: string): Promise<GitHubPR[]> {
  try {
    const data = await fetchGitHubGraphQL(CREATED_BY_ME_QUERY, {}, token) as {
      viewer: {
        pullRequests: {
          nodes: Array<{
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
            labels: {
              nodes: Array<{
                name: string;
                color: string;
              }>;
            };
            reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED';
            additions: number;
            deletions: number;
            changedFiles: number;
          }>;
        };
      };
    };

    return data.viewer.pullRequests.nodes.map(pr => ({
      ...pr,
      labels: pr.labels.nodes,
    }));
  } catch (error) {
    console.error('Error fetching PRs created by me:', error);
    throw error;
  }
}

/**
 * Fetches pull requests assigned to the current user for review
 */
export async function fetchReviewRequested(token: string): Promise<GitHubPR[]> {
  try {
    // First, get the current user's username
    const userQuery = `query { viewer { login } }`;
    const userData = await fetchGitHubGraphQL(userQuery, {}, token) as { viewer: { login: string } };
    const username = userData.viewer.login;

    // Then fetch PRs with review requested using dynamically built query
    const data = await fetchGitHubGraphQL(buildReviewRequestedQuery(username), {}, token) as {
      search: {
        nodes: Array<{
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
          labels: {
            nodes: Array<{
              name: string;
              color: string;
            }>;
          };
          reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED';
          additions: number;
          deletions: number;
          changedFiles: number;
        }>;
      };
    };

    return data.search.nodes.map(pr => ({
      ...pr,
      labels: pr.labels.nodes,
    }));
  } catch (error) {
    console.error('Error fetching PRs for review:', error);
    throw error;
  }
}

/**
 * Fetches all GitHub PRs (created by me and review requested)
 */
export async function fetchAllGitHubPRs(token: string): Promise<{
  createdByMe: GitHubPR[];
  reviewRequested: GitHubPR[];
}> {
  const [createdByMe, reviewRequested] = await Promise.all([
    fetchCreatedByMe(token),
    fetchReviewRequested(token),
  ]);

  return {
    createdByMe,
    reviewRequested,
  };
}
