import { useEffect, useState } from 'preact/hooks';
import { linearIssues, currentView } from '@/store/store';
import { fetchAllLinearIssues, isLinearConnected, getPriorityLabel } from '@/utils/linearApi';
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

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const truncateComment = (text: string, maxLength: number = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
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
  const issueCount = filteredIssues.length;

  return (
    <div class="linear-view">
      <div class="linear-header">
        <h1 class="linear-title">Linear</h1>
        <div class="linear-stats">
          {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
        </div>
      </div>

      <div class="linear-filters">
        <button
          class={`filter-btn ${filter === 'assigned' ? 'active' : ''}`}
          onClick={() => setFilter('assigned')}
        >
          Assigned to me
        </button>
        <button
          class={`filter-btn ${filter === 'created' ? 'active' : ''}`}
          onClick={() => setFilter('created')}
        >
          Created by me
        </button>
        <button
          class={`filter-btn ${filter === 'mentioning' ? 'active' : ''}`}
          onClick={() => setFilter('mentioning')}
        >
          Mentioning me
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
                <div class="linear-issue-meta-row">
                  <span class="linear-issue-id">{issue.identifier}</span>
                  <span class="linear-issue-status">{issue.state.name}</span>
                  {issue.priority > 0 && (
                    <span class="linear-issue-priority">
                      {getPriorityLabel(issue.priority)}
                    </span>
                  )}
                </div>
                <span class="linear-issue-updated">
                  {formatRelativeTime(issue.updatedAt)}
                </span>
              </div>

              <div class="linear-issue-title">{issue.title}</div>

              {issue.lastComment && (
                <div class="linear-issue-comment">
                  <span class="linear-issue-comment-author">
                    {issue.lastComment.user.name}:
                  </span>
                  <span class="linear-issue-comment-text">
                    {truncateComment(issue.lastComment.body)}
                  </span>
                </div>
              )}

              <div class="linear-issue-footer">
                {issue.project && (
                  <span class="linear-issue-project">
                    {issue.project.name}
                  </span>
                )}
                <span class="linear-issue-team">
                  {issue.team.name}
                </span>
                {issue.assignee && filter !== 'assigned' && (
                  <span class="linear-issue-assignee">
                    {issue.assignee.name}
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
