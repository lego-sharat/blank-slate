import { todos, thoughts, nextEvent } from '@/store/store';

export default function StatusBar() {
  const incompleteTodosCount = todos.value.filter(t => !t.completed).length;
  const notesCount = thoughts.value.length;

  const getTimeUntilEvent = () => {
    if (!nextEvent.value) return null;

    const now = new Date();
    const eventTime = new Date(nextEvent.value.start.dateTime || nextEvent.value.start.date || '');
    const diffMs = eventTime.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'now';
    if (diffMins < 60) return `in ${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
  };

  return (
    <div class="status-bar">
      <div class="status-bar-left">
        {incompleteTodosCount > 0 && (
          <span class="status-item">
            {incompleteTodosCount} task{incompleteTodosCount !== 1 ? 's' : ''}
          </span>
        )}
        {notesCount > 0 && (
          <span class="status-item">
            {notesCount} thought{notesCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div class="status-bar-right">
        {nextEvent.value && (
          <span class="status-item">
            Next: {nextEvent.value.summary} {getTimeUntilEvent()}
          </span>
        )}
      </div>
    </div>
  );
}
