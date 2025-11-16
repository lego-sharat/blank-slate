import { useComputed } from '@preact/signals';
import { todos, notes, nextEvent, currentView, isAuthenticated, linearIssues, githubPRs, settings } from '@/store/store';
import { toggleTodo } from '@/utils/todoActions';
import { openNote } from '@/utils/noteActions';

export default function GlanceView() {
  const upcomingEvent = useComputed(() => nextEvent.value);
  const incompleteTasks = useComputed(() => todos.value.filter(t => !t.completed).slice(0, 3));
  const inProgressNotes = useComputed(() => notes.value.filter(n => n.status === 'draft').slice(0, 3));
  const assignedLinearIssues = useComputed(() => {
    // Sort by status priority (started → unstarted → backlog) then by creation date
    const statusOrder: Record<string, number> = {
      'started': 1,
      'unstarted': 2,
      'backlog': 3,
    };
    return [...linearIssues.value.assignedToMe]
      .sort((a, b) => {
        const orderA = statusOrder[a.state.type] || 99;
        const orderB = statusOrder[b.state.type] || 99;
        if (orderA === orderB) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return orderA - orderB;
      })
      .slice(0, 3);
  });

  const reviewRequestedPRs = useComputed(() => {
    // Sort by updated time (most recently updated first)
    return [...githubPRs.value.reviewRequested]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3);
  });

  const formatTimeRange = (start: { dateTime?: string; date?: string }, end: { dateTime?: string; date?: string }): string => {
    if (start.dateTime && end.dateTime) {
      const startDate = new Date(start.dateTime);
      const endDate = new Date(end.dateTime);
      const startTime = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const endTime = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${startTime} - ${endTime}`;
    }
    return 'All day';
  };

  const getStatusClass = (stateType: string): string => {
    if (stateType === 'started') return 'status-in-progress';
    if (stateType === 'backlog') return 'status-backlog';
    if (stateType === 'unstarted') return 'status-todo';
    return 'status-other';
  };

  const getStatusLabel = (stateType: string): string => {
    if (stateType === 'started') return 'In Progress';
    if (stateType === 'backlog') return 'Backlog';
    if (stateType === 'unstarted') return 'Todo';
    return stateType;
  };

  const getPriorityClass = (priority: number): string => {
    if (priority === 1) return 'priority-urgent';
    if (priority === 2) return 'priority-high';
    if (priority === 3) return 'priority-medium';
    if (priority === 4) return 'priority-low';
    return 'priority-none';
  };

  const getPriorityLabel = (priority: number): string => {
    if (priority === 1) return 'Urgent';
    if (priority === 2) return 'High';
    if (priority === 3) return 'Medium';
    if (priority === 4) return 'Low';
    return 'No Priority';
  };

  const getPRStateClass = (state: string, isDraft: boolean): string => {
    if (isDraft) return 'pr-state-draft';
    if (state === 'OPEN') return 'pr-state-open';
    if (state === 'MERGED') return 'pr-state-merged';
    if (state === 'CLOSED') return 'pr-state-closed';
    return 'pr-state-other';
  };

  const getPRStateLabel = (state: string, isDraft: boolean): string => {
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
    return '';
  };

  return (
    <div class="glance-view">
      <div class="glance-header">
        <h1 class="glance-title">Glance</h1>
      </div>

      <div class="glance-feed">
        {/* Next Event Section */}
        {isAuthenticated.value && upcomingEvent.value && (
          <div class="glance-section">
            <div class="glance-section-header">
              <h2 class="glance-section-title">Next Event</h2>
              <button class="glance-view-all" onClick={() => currentView.value = 'today'}>
                View all
              </button>
            </div>

            <div class="glance-event-card">
              <div class="glance-event-title">{upcomingEvent.value.summary}</div>
              <div class="glance-event-time">{formatTimeRange(upcomingEvent.value.start, upcomingEvent.value.end)}</div>
            </div>
          </div>
        )}

        {/* Tasks Section */}
        {incompleteTasks.value.length > 0 && (
          <div class="glance-section">
            <div class="glance-section-header">
              <h2 class="glance-section-title">Tasks</h2>
              <button class="glance-view-all" onClick={() => currentView.value = 'tasks'}>
                View all
              </button>
            </div>

            <div class="glance-tasks-list">
              {incompleteTasks.value.map(todo => (
                <div key={todo.id} class="glance-task-item">
                  <label class="glance-task-checkbox-wrapper">
                    <input
                      type="checkbox"
                      class="glance-task-checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id)}
                    />
                    <span class="glance-task-checkbox-custom"></span>
                  </label>
                  <span class="glance-task-text">{todo.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes Section */}
        {inProgressNotes.value.length > 0 && (
          <div class="glance-section">
            <div class="glance-section-header">
              <h2 class="glance-section-title">In Progress Notes</h2>
              <button class="glance-view-all" onClick={() => currentView.value = 'notes'}>
                View all
              </button>
            </div>

            <div class="glance-notes-list">
              {inProgressNotes.value.map(note => (
                <div
                  key={note.id}
                  class="glance-note-item"
                  onClick={() => openNote(note.id)}
                >
                  <div class="glance-note-title">{note.title || 'Untitled'}</div>
                  {note.content && (
                    <div class="glance-note-preview">
                      {note.content.substring(0, 80)}
                      {note.content.length > 80 && '...'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linear Issues Section */}
        {settings.value.linearApiKey && assignedLinearIssues.value.length > 0 && (
          <div class="glance-section">
            <div class="glance-section-header">
              <h2 class="glance-section-title">Linear Issues</h2>
              <button class="glance-view-all" onClick={() => currentView.value = 'linear'}>
                View all
              </button>
            </div>

            <div class="glance-linear-list">
              {assignedLinearIssues.value.map(issue => (
                <div
                  key={issue.id}
                  class="glance-linear-item"
                  onClick={() => window.open(issue.url, '_blank')}
                >
                  <div class="glance-linear-header">
                    <span class="glance-linear-identifier">{issue.identifier}</span>
                    <div class="glance-linear-badges">
                      <span class={`glance-linear-status ${getStatusClass(issue.state.type)}`}>
                        {getStatusLabel(issue.state.type)}
                      </span>
                      {issue.priority > 0 && (
                        <span class={`glance-linear-priority ${getPriorityClass(issue.priority)}`}>
                          {getPriorityLabel(issue.priority)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div class="glance-linear-title">{issue.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GitHub PRs Section */}
        {settings.value.githubToken && reviewRequestedPRs.value.length > 0 && (
          <div class="glance-section">
            <div class="glance-section-header">
              <h2 class="glance-section-title">GitHub PRs</h2>
              <button class="glance-view-all" onClick={() => currentView.value = 'github'}>
                View all
              </button>
            </div>

            <div class="glance-github-list">
              {reviewRequestedPRs.value.map(pr => (
                <div
                  key={pr.id}
                  class="glance-github-item"
                  onClick={() => window.open(pr.url, '_blank')}
                >
                  <div class="glance-github-header">
                    <span class="glance-github-repo">{pr.repository.nameWithOwner}</span>
                    <div class="glance-github-badges">
                      <span class={`glance-github-state ${getPRStateClass(pr.state, pr.isDraft)}`}>
                        {getPRStateLabel(pr.state, pr.isDraft)}
                      </span>
                      {pr.reviewDecision && (
                        <span class={`glance-github-review ${getReviewClass(pr.reviewDecision)}`}>
                          {getReviewLabel(pr.reviewDecision)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div class="glance-github-title">{pr.title}</div>
                  <div class="glance-github-footer">
                    <span class="glance-github-number">#{pr.number}</span>
                    <span class="glance-github-author">@{pr.author.login}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
