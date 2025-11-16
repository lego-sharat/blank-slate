import { useEffect, useState } from 'preact/hooks';
import { linearIssues, currentView } from '@/store/store';
import { fetchAllLinearIssues, isLinearConnected, getPriorityLabel, getPriorityColor } from '@/utils/linearApi';
import type { LinearIssue } from '@/types';

type FilterType = 'assigned' | 'created' | 'mentioning';

export default function LinearView() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('assigned');

  const issues = linearIssues.value;
  const hasApiKey = isLinearConnected();

  useEffect(() => {
    if (hasApiKey && Object.values(issues).flat().length === 0) {
      handleFetchIssues();
    }
  }, [hasApiKey]);

  const handleFetchIssues = async () => {
    if (!hasApiKey) return;

    setLoading(true);
    setError(null);

    try {
      const fetchedIssues = await fetchAllLinearIssues();
      linearIssues.value = fetchedIssues;
    } catch (err) {
      console.error('Error fetching Linear issues:', err);
      setError('Failed to load Linear issues. Please check your API key in settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureLinear = () => {
    currentView.value = 'settings';
  };

  const getFilteredIssues = (): LinearIssue[] => {
    switch (filter) {
      case 'assigned':
        return issues.assignedToMe;
      case 'created':
        return issues.createdByMe;
      case 'mentioning':
        return issues.mentioningMe;
      default:
        return [];
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStateIcon = (stateType: string) => {
    switch (stateType) {
      case 'started':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
          </svg>
        );
      case 'completed':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
        );
      case 'canceled':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        );
      case 'backlog':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
          </svg>
        );
    }
  };

  if (!hasApiKey) {
    return (
      <div class="linear-view">
        <div class="linear-header">
          <h1 class="linear-title">Linear</h1>
        </div>
        <div class="linear-empty">
          <p>Configure Linear API key to view your issues</p>
          <button class="linear-configure-btn" onClick={handleConfigureLinear}>
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div class="linear-view">
        <div class="linear-header">
          <h1 class="linear-title">Linear</h1>
        </div>
        <div class="linear-empty">
          <p>Loading issues...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="linear-view">
        <div class="linear-header">
          <h1 class="linear-title">Linear</h1>
        </div>
        <div class="linear-empty">
          <p>{error}</p>
          <button class="linear-refresh-btn" onClick={handleFetchIssues}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const filteredIssues = getFilteredIssues();

  return (
    <div class="linear-view">
      <div class="linear-header">
        <h1 class="linear-title">Linear</h1>
        <button class="linear-refresh-btn" onClick={handleFetchIssues} title="Refresh issues">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>

      <div class="linear-filters">
        <button
          class={`linear-filter-btn ${filter === 'assigned' ? 'active' : ''}`}
          onClick={() => setFilter('assigned')}
        >
          Assigned to me
          {issues.assignedToMe.length > 0 && (
            <span class="linear-filter-count">{issues.assignedToMe.length}</span>
          )}
        </button>
        <button
          class={`linear-filter-btn ${filter === 'created' ? 'active' : ''}`}
          onClick={() => setFilter('created')}
        >
          Created by me
          {issues.createdByMe.length > 0 && (
            <span class="linear-filter-count">{issues.createdByMe.length}</span>
          )}
        </button>
        <button
          class={`linear-filter-btn ${filter === 'mentioning' ? 'active' : ''}`}
          onClick={() => setFilter('mentioning')}
        >
          Mentioning me
          {issues.mentioningMe.length > 0 && (
            <span class="linear-filter-count">{issues.mentioningMe.length}</span>
          )}
        </button>
      </div>

      {filteredIssues.length === 0 ? (
        <div class="linear-empty">
          <p>No issues found</p>
        </div>
      ) : (
        <div class="linear-issues-list">
          {filteredIssues.map((issue) => (
            <a
              key={issue.id}
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              class="linear-issue-item"
            >
              <div class="linear-issue-header">
                <div class="linear-issue-identifier">
                  <span
                    class="linear-issue-state-icon"
                    style={{ color: `#${issue.state.color}` }}
                    title={issue.state.name}
                  >
                    {getStateIcon(issue.state.type)}
                  </span>
                  <span class="linear-issue-id">{issue.identifier}</span>
                </div>
                {issue.priority > 0 && (
                  <div
                    class="linear-issue-priority"
                    style={{
                      backgroundColor: getPriorityColor(issue.priority),
                      color: 'white'
                    }}
                  >
                    {getPriorityLabel(issue.priority)}
                  </div>
                )}
              </div>

              <div class="linear-issue-title">{issue.title}</div>

              <div class="linear-issue-meta">
                {issue.project && (
                  <div class="linear-issue-project">
                    <span
                      class="linear-issue-project-dot"
                      style={{ backgroundColor: `#${issue.project.color}` }}
                    />
                    {issue.project.name}
                  </div>
                )}

                <div class="linear-issue-team">
                  {issue.team.name}
                </div>

                {issue.dueDate && (
                  <div class="linear-issue-due">
                    Due {formatDate(issue.dueDate)}
                  </div>
                )}
              </div>

              {issue.labels && issue.labels.length > 0 && (
                <div class="linear-issue-labels">
                  {issue.labels.map((label) => (
                    <span
                      key={label.id}
                      class="linear-issue-label"
                      style={{
                        backgroundColor: `#${label.color}20`,
                        color: `#${label.color}`
                      }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              )}

              {issue.assignee && filter !== 'assigned' && (
                <div class="linear-issue-assignee">
                  {issue.assignee.avatarUrl ? (
                    <img
                      src={issue.assignee.avatarUrl}
                      alt={issue.assignee.name}
                      class="linear-issue-avatar"
                    />
                  ) : (
                    <div class="linear-issue-avatar-placeholder">
                      {issue.assignee.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span class="linear-issue-assignee-name">{issue.assignee.name}</span>
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
