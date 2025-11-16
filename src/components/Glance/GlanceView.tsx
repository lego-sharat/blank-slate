import { useComputed } from '@preact/signals';
import { todos, notes, readingList, nextEvent } from '@/store/store';

export default function GlanceView() {
  // Get most important items for each category
  const nextCalendarEvent = useComputed(() => nextEvent.value);
  const firstIncompleteTodo = useComputed(() => todos.value.find(t => !t.completed));
  const firstDraftNote = useComputed(() => notes.value.find(n => n.status === 'draft'));
  const firstUnreadItem = useComputed(() => readingList.value.find(r => r.status === 'unread'));

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTimeRange = (start: string, end: string) => {
    return `${formatTime(start)}-${formatTime(end)}`;
  };

  const getTimeUntilEvent = (dateString: string) => {
    const now = new Date();
    const eventTime = new Date(dateString);
    const diffMs = eventTime.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'now';
    if (diffMins < 60) return `in ${diffMins} minutes`;
    const hours = Math.floor(diffMins / 60);
    return `in ${hours} hour${hours > 1 ? 's' : ''}`;
  };

  const extractMeetingLink = (event: any) => {
    if (event.hangoutLink) return event.hangoutLink;
    if (event.conferenceData?.entryPoints?.[0]?.uri) {
      return event.conferenceData.entryPoints[0].uri;
    }
    if (event.location && event.location.includes('http')) {
      const urlMatch = event.location.match(/(https?:\/\/[^\s]+)/);
      return urlMatch ? urlMatch[0] : null;
    }
    return null;
  };

  const getMeetingPlatform = (link: string | null) => {
    if (!link) return null;
    if (link.includes('zoom.us')) return 'Zoom';
    if (link.includes('meet.google.com')) return 'Google Meet';
    if (link.includes('teams.microsoft.com')) return 'Teams';
    return 'Meeting';
  };

  const getAttendeeCount = (event: any) => {
    return event.attendees?.length || 0;
  };

  return (
    <div class="glance-view">
      <div class="glance-items">
        {/* Next Calendar Event */}
        {nextCalendarEvent.value && (
          <div class="glance-item glance-event">
            <div class="glance-item-header">
              <h3 class="glance-item-title">{nextCalendarEvent.value.summary}</h3>
              <span class="glance-item-timing">
                {getTimeUntilEvent(nextCalendarEvent.value.start.dateTime || nextCalendarEvent.value.start.date || '')}
              </span>
            </div>
            <div class="glance-item-meta">
              {nextCalendarEvent.value.start.dateTime && nextCalendarEvent.value.end.dateTime && (
                <span class="glance-meta-item">
                  {formatTimeRange(nextCalendarEvent.value.start.dateTime, nextCalendarEvent.value.end.dateTime)}
                </span>
              )}
              {(() => {
                const link = extractMeetingLink(nextCalendarEvent.value);
                const platform = getMeetingPlatform(link);
                return platform && (
                  <span class="glance-meta-item">
                    {platform}
                  </span>
                );
              })()}
              {getAttendeeCount(nextCalendarEvent.value) > 0 && (
                <span class="glance-meta-item">
                  {getAttendeeCount(nextCalendarEvent.value)} people
                </span>
              )}
            </div>
            {extractMeetingLink(nextCalendarEvent.value) && (
              <button
                class="glance-action-btn"
                onClick={() => window.open(extractMeetingLink(nextCalendarEvent.value), '_blank')}
              >
                Join
              </button>
            )}
          </div>
        )}

        {/* First Incomplete Todo */}
        {firstIncompleteTodo.value && (
          <div class="glance-item glance-todo">
            <div class="glance-item-content">
              <input
                type="checkbox"
                checked={false}
                class="glance-checkbox"
                onChange={() => {
                  const todo = todos.value.find(t => t.id === firstIncompleteTodo.value?.id);
                  if (todo) {
                    todo.completed = true;
                    todos.value = [...todos.value];
                  }
                }}
              />
              <span class="glance-todo-text">{firstIncompleteTodo.value.text}</span>
            </div>
          </div>
        )}

        {/* First Draft Note */}
        {firstDraftNote.value && (
          <div class="glance-item glance-note">
            <div class="glance-item-header">
              <span class="glance-status-badge draft">draft</span>
              <h3 class="glance-item-title">{firstDraftNote.value.title}</h3>
            </div>
            {firstDraftNote.value.content && (
              <div class="glance-item-preview">
                {firstDraftNote.value.content.substring(0, 100)}
                {firstDraftNote.value.content.length > 100 && '...'}
              </div>
            )}
            <button
              class="glance-action-btn"
              onClick={() => {
                // TODO: Navigate to note editor
                console.log('Open note:', firstDraftNote.value?.id);
              }}
            >
              Edit
            </button>
          </div>
        )}

        {/* First Unread Reading Item */}
        {firstUnreadItem.value && (
          <div class="glance-item glance-reading">
            <div class="glance-item-header">
              <svg class="glance-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              <h3 class="glance-item-title">{firstUnreadItem.value.title}</h3>
            </div>
            {firstUnreadItem.value.url && (
              <button
                class="glance-action-btn"
                onClick={() => window.open(firstUnreadItem.value?.url, '_blank')}
              >
                Read
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {!nextCalendarEvent.value && !firstIncompleteTodo.value && !firstDraftNote.value && !firstUnreadItem.value && (
          <div class="glance-empty">
            <p>Nothing on your plate right now.</p>
            <p class="glance-empty-subtitle">Add a task or note to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
