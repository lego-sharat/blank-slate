import { useState } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import { githubPRs, settings } from '@/store/store';
import type { GitHubPR } from '@/types';

export default function GitHubView() {
  const [filter, setFilter] = useState<'created' | 'review'>('created');
  const prs = useComputed(() => githubPRs.value);

  const getFilteredPRs = (): GitHubPR[] => {
    let filtered: GitHubPR[];
    switch (filter) {
      case 'created':
        filtered = prs.value.createdByMe;
        break;
      case 'review':
        filtered = prs.value.reviewRequested;
        break;
      default:
        filtered = [];
    }
    return filtered.slice(0, 10);
  };

  const handleViewAll = () => {
    let url = 'https://github.com/pulls';

    switch (filter) {
      case 'created':
        url = 'https://github.com/pulls?q=is%3Aopen+is%3Apr+author%3A%40me';
        break;
      case 'review':
        url = 'https://github.com/pulls?q=is%3Aopen+is%3Apr+review-requested%3A%40me';
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
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStateClass = (state: string): string => {
    if (state === 'OPEN') return 'state-open';
    if (state === 'MERGED') return 'state-merged';
    if (state === 'CLOSED') return 'state-closed';
    return 'state-other';
  };

  const getStateLabel = (state: string, isDraft: boolean): string => {
    if (isDraft) return 'Draft';
    if (state === 'OPEN') return 'Open';
    if (state === 'MERGED') return 'Merged';
    if (state === 'CLOSED') return 'Closed';
    return state;
  };

  const getReviewClass = (review?: string): string => {
    if (review === 'APPROVED') return 'review-approved';
    if (review === 'CHANGES_REQUESTED') return 'review-changes';
    if (review === 'REVIEW_REQUIRED') return 'review-required';
    return 'review-none';
  };

  const getReviewLabel = (review?: string): string => {
    if (review === 'APPROVED') return 'Approved';
    if (review === 'CHANGES_REQUESTED') return 'Changes Requested';
    if (review === 'REVIEW_REQUIRED') return 'Review Required';
    return 'No Review';
  };

  const filteredPRs = getFilteredPRs();
  const hasGitHubToken = settings.value.githubToken && settings.value.githubToken.length > 0;

  if (!hasGitHubToken) {
    return (
      <div class="github-view">
        <div class="github-header">
          <h1 class="github-title">GitHub</h1>
        </div>
        <div class="github-empty-state">
          <p>Please configure your GitHub token in settings to view pull requests.</p>
        </div>
      </div>
    );
  }

  return (
    <div class="github-view">
      <div class="github-header">
        <h1 class="github-title">GitHub</h1>
        <div class="github-header-actions">
          <span class="github-stats">{filteredPRs.length} PRs</span>
          <button class="github-view-all-button" onClick={handleViewAll}>
            View All
          </button>
        </div>
      </div>

      <div class="github-filters">
        <button
          class={`github-filter-btn ${filter === 'created' ? 'active' : ''}`}
          onClick={() => setFilter('created')}
        >
          Created by me
          {prs.value.createdByMe.length > 0 && (
            <span class="github-filter-count">{prs.value.createdByMe.length}</span>
          )}
        </button>
        <button
          class={`github-filter-btn ${filter === 'review' ? 'active' : ''}`}
          onClick={() => setFilter('review')}
        >
          Review requested
          {prs.value.reviewRequested.length > 0 && (
            <span class="github-filter-count">{prs.value.reviewRequested.length}</span>
          )}
        </button>
      </div>

      {filteredPRs.length === 0 ? (
        <div class="github-empty-state">
          <p>No pull requests found.</p>
        </div>
      ) : (
        <div class="github-pr-list">
          {filteredPRs.map(pr => (
            <div key={pr.id} class="github-pr-item" onClick={() => window.open(pr.url, '_blank')}>
              <div class="github-pr-header">
                <div class="github-pr-title-row">
                  <span class="github-pr-repo">{pr.repository.nameWithOwner}</span>
                  <span class="github-pr-number">#{pr.number}</span>
                </div>
                <div class="github-pr-badges">
                  <span class={`github-pr-state ${getStateClass(pr.state)}`}>
                    {getStateLabel(pr.state, pr.isDraft)}
                  </span>
                  {pr.reviewDecision && (
                    <span class={`github-pr-review ${getReviewClass(pr.reviewDecision)}`}>
                      {getReviewLabel(pr.reviewDecision)}
                    </span>
                  )}
                </div>
              </div>

              <div class="github-pr-title">{pr.title}</div>

              <div class="github-pr-footer">
                <span class="github-pr-author">@{pr.author.login}</span>
                <span class="github-pr-time">{formatRelativeTime(pr.updatedAt)}</span>
                <span class="github-pr-stats">
                  +{pr.additions} -{pr.deletions}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
