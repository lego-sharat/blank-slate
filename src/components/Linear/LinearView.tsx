import { useEffect, useState } from 'preact/hooks';
import { linearIssues, currentView } from '@/store/store';
import { isLinearConnected, getPriorityLabel } from '@/utils/linearApi';
import { refreshAllData } from '@/utils/dataSync';
import type { LinearIssue } from '@/types';

type FilterType = 'assigned' | 'created' | 'mentioning';

export default function LinearView() {
  const [filter, setFilter] = useState<FilterType>('assigned');

  // Use cached issues from signal (fetched by background script)
  const issues = linearIssues.value;
  const hasApiKey = isLinearConnected();

  // Refresh data when component mounts if API key is configured
  useEffect(() => {
    if (hasApiKey) {
      // Request fresh data from background
      refreshAllData();
    }
  }, [hasApiKey]);

  const handleConfigureLinear = () => {
    currentView.value = 'settings';
  };

  const sortByStatus = (issues: LinearIssue[]): LinearIssue[] => {
    // Define priority order for status types
    const statusOrder: Record<string, number> = {
      'started': 1,      // In Progress - highest priority
      'unstarted': 2,    // Todo - needs to be started
      'backlog': 3,      // Backlog - lower priority
    };

    return [...issues].sort((a, b) => {
      const orderA = statusOrder[a.state.type] || 99;
      const orderB = statusOrder[b.state.type] || 99;

      // If same status, sort by creation date (newest first)
      if (orderA === orderB) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      return orderA - orderB;
    });
  };

  const getFilteredIssues = (): LinearIssue[] => {
    let filtered: LinearIssue[];
    switch (filter) {
      case 'assigned':
        filtered = sortByStatus(issues.assignedToMe);
        break;
      case 'created':
        filtered = sortByStatus(issues.createdByMe);
        break;
      case 'mentioning':
        // Already sorted by updatedAt from API
        filtered = issues.mentioningMe;
        break;
      default:
        filtered = [];
    }
    // Limit to 10 issues
    return filtered.slice(0, 10);
  };

  const handleViewAll = () => {
    // Build Linear URL with appropriate filters
    let url = 'https://linear.app/issues';

    switch (filter) {
      case 'assigned':
        url = 'https://linear.app/issues?filter=assignee%3Ame';
        break;
      case 'created':
        url = 'https://linear.app/issues?filter=creator%3Ame';
        break;
      case 'mentioning':
        url = 'https://linear.app/issues?filter=subscribers%3Ame';
        break;
    }

    window.open(url, '_blank');
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

  const getStatusColorClass = (stateType: string): string => {
    switch (stateType) {
      case 'started':
        return 'status-in-progress';
      case 'backlog':
        return 'status-backlog';
      case 'unstarted':
        return 'status-todo';
      default:
        return 'status-default';
    }
  };

  const getPriorityColorClass = (priority: number): string => {
    switch (priority) {
      case 1: return 'priority-urgent';
      case 2: return 'priority-high';
      case 3: return 'priority-medium';
      case 4: return 'priority-low';
      default: return 'priority-none';
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

  const filteredIssues = getFilteredIssues();
  const issueCount = filteredIssues.length;

  return (
    <div class="linear-view">
      <div class="linear-header">
        <h1 class="linear-title">Linear</h1>
        <div class="linear-header-actions">
          <div class="linear-stats">
            {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
          </div>
          <button class="linear-view-all-btn" onClick={handleViewAll}>
            View All
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
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
                  <span class={`linear-issue-status ${getStatusColorClass(issue.state.type)}`}>
                    {issue.state.name}
                  </span>
                  {issue.priority > 0 && (
                    <span class={`linear-issue-priority ${getPriorityColorClass(issue.priority)}`}>
                      {getPriorityLabel(issue.priority)}
                    </span>
                  )}
                </div>
                <span class="linear-issue-updated">
                  {formatRelativeTime(issue.createdAt)}
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
