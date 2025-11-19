import { useState, useEffect } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import { mailThreads } from '@/store/store';
import type { MailThread } from '@/types';
import {
  checkGmailConnection,
  markThreadAsRead,
} from '@/utils/mailThreadsSync';
import { archiveThread } from '@/utils/mailSupabaseSync';

export default function MailView() {
  const [filter, setFilter] = useState<'all' | 'onboarding' | 'support'>('all');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const threads = useComputed(() => mailThreads.value);

  // Check Gmail connection status on mount
  useEffect(() => {
    checkGmailConnection().then((status) => {
      setIsConnected(status.connected);
    });
  }, []);

  // Get all unique AI labels from threads
  const availableLabels = useComputed(() => {
    const labelsSet = new Set<string>();
    threads.value.all.forEach(thread => {
      thread.ai_labels?.forEach(label => labelsSet.add(label));
    });
    return Array.from(labelsSet).sort();
  });

  const getFilteredThreads = (): MailThread[] => {
    let filtered: MailThread[];

    // First filter by category tab
    switch (filter) {
      case 'all':
        filtered = threads.value.all;
        break;
      case 'onboarding':
        filtered = threads.value.onboarding;
        break;
      case 'support':
        filtered = threads.value.support;
        break;
      default:
        filtered = [];
    }

    // Then filter by selected labels
    if (selectedLabels.length > 0) {
      filtered = filtered.filter(thread =>
        selectedLabels.some(label => thread.ai_labels?.includes(label))
      );
    }

    return filtered.slice(0, 100); // Limit to 100 threads
  };

  const toggleLabelFilter = (label: string) => {
    setSelectedLabels(prev =>
      prev.includes(label)
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  const toggleExpand = (threadId: string) => {
    setExpandedThreadId(expandedThreadId === threadId ? null : threadId);
  };

  const handleToggleRead = async (threadId: string, currentUnreadStatus: boolean, e: Event) => {
    e.stopPropagation();
    await markThreadAsRead(threadId, currentUnreadStatus);
    // The background sync will update the cache
  };

  const handleArchive = async (threadId: string, e: Event) => {
    e.stopPropagation();

    const result = await archiveThread(threadId, true);

    if (result.success) {
      console.log('Thread archived successfully');
      // The background sync will update the UI by removing the archived thread
    } else {
      console.error('Failed to archive thread:', result.error);
      alert(`Failed to archive: ${result.error}`);
    }
  };

  const handleViewAll = () => {
    window.open('https://mail.google.com/', '_blank');
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

  const getCategoryBadgeClass = (category: string): string => {
    if (category === 'onboarding') return 'mail-badge-onboarding';
    if (category === 'support') return 'mail-badge-support';
    return 'mail-badge-general';
  };

  const getCategoryLabel = (category: string): string => {
    if (category === 'onboarding') return 'Onboarding';
    if (category === 'support') return 'Support';
    return '';
  };

  const getLabelBadgeClass = (label: string): string => {
    if (label === 'high-priority') return 'mail-label-priority';
    if (label === 'needs-response') return 'mail-label-urgent';
    if (label === 'cold-email') return 'mail-label-cold';
    if (label === 'customer-support') return 'mail-label-support';
    return 'mail-label-default';
  };

  const getSatisfactionColor = (score: number): string => {
    if (score >= 8) return '#4ade80'; // green
    if (score >= 6) return '#fbbf24'; // yellow
    if (score >= 4) return '#fb923c'; // orange
    return '#f87171'; // red
  };

  const filteredThreads = getFilteredThreads();

  return (
    <div class="mail-view">
      <div class="mail-header">
        <h1 class="mail-title">Mail</h1>
        <div class="mail-header-actions">
          <span class="mail-stats">{filteredThreads.length} threads</span>
          <button class="mail-view-all-button" onClick={handleViewAll}>
            Open Gmail
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div class="mail-filters">
        <button
          class={`mail-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Mail
          {threads.value.all.length > 0 && (
            <span class="mail-filter-count">{threads.value.all.length}</span>
          )}
        </button>
        <button
          class={`mail-filter-btn ${filter === 'onboarding' ? 'active' : ''}`}
          onClick={() => setFilter('onboarding')}
        >
          Onboarding
          {threads.value.onboarding.length > 0 && (
            <span class="mail-filter-count">{threads.value.onboarding.length}</span>
          )}
        </button>
        <button
          class={`mail-filter-btn ${filter === 'support' ? 'active' : ''}`}
          onClick={() => setFilter('support')}
        >
          Support
          {threads.value.support.length > 0 && (
            <span class="mail-filter-count">{threads.value.support.length}</span>
          )}
        </button>
      </div>

      {/* Label Filters */}
      {availableLabels.value.length > 0 && (
        <div class="mail-label-filters">
          <span class="mail-label-filters-title">Labels:</span>
          <div class="mail-label-chips">
            {availableLabels.value.map(label => (
              <button
                key={label}
                class={`mail-label-chip ${selectedLabels.includes(label) ? 'active' : ''} ${getLabelBadgeClass(label)}`}
                onClick={() => toggleLabelFilter(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isConnected && (
        <div class="mail-connection-warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>Gmail not connected. Connect in Settings to sync your emails.</span>
        </div>
      )}

      {filteredThreads.length === 0 ? (
        <div class="mail-empty-state">
          <p>{isConnected ? 'No threads found.' : 'Connect Gmail to see your emails here.'}</p>
        </div>
      ) : (
        <div class="mail-list">
          {filteredThreads.map(thread => {
            const isExpanded = expandedThreadId === thread.id;
            const firstParticipant = thread.participants[0];

            return (
              <div
                key={thread.id}
                class={`mail-item ${thread.is_unread ? 'unread' : ''} ${isExpanded ? 'expanded' : ''}`}
              >
                <div class="mail-item-content" onClick={() => toggleExpand(thread.id)}>
                  <div class="mail-item-header">
                    <div class="mail-from">
                      <span class="mail-sender-name">
                        {firstParticipant?.name || firstParticipant?.email || 'Unknown'}
                      </span>
                      {thread.message_count > 1 && (
                        <span class="mail-message-count">({thread.message_count})</span>
                      )}
                      {thread.is_unread && <span class="mail-unread-dot"></span>}
                    </div>
                    <div class="mail-badges">
                      {thread.category && thread.category !== 'general' && (
                        <span class={`mail-badge ${getCategoryBadgeClass(thread.category)}`}>
                          {getCategoryLabel(thread.category)}
                        </span>
                      )}
                      {thread.integration_name && (
                        <span class="mail-badge mail-badge-integration" title={`Integration: ${thread.integration_name}`}>
                          {thread.integration_name}
                        </span>
                      )}
                      {thread.has_attachments && (
                        <span class="mail-attachment-icon" title="Has attachments">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                          </svg>
                        </span>
                      )}
                    </div>
                  </div>

                  <div class="mail-subject">{thread.subject || '(No subject)'}</div>

                  {/* AI Summary */}
                  {thread.summary && (
                    <div class="mail-ai-summary">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4"/>
                        <path d="M12 8h.01"/>
                      </svg>
                      <span>{thread.summary}</span>
                    </div>
                  )}

                  {/* AI Labels */}
                  {thread.ai_labels && thread.ai_labels.length > 0 && (
                    <div class="mail-ai-labels">
                      {thread.ai_labels.slice(0, 3).map(label => (
                        <span key={label} class={`mail-label-badge ${getLabelBadgeClass(label)}`}>
                          {label}
                        </span>
                      ))}
                      {thread.ai_labels.length > 3 && (
                        <span class="mail-label-more">+{thread.ai_labels.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Satisfaction Score (for onboarding/support) */}
                  {thread.satisfaction_score && (thread.category === 'onboarding' || thread.category === 'support') && (
                    <div class="mail-satisfaction">
                      <span class="mail-satisfaction-label">Customer Satisfaction:</span>
                      <div class="mail-satisfaction-score" style={{ color: getSatisfactionColor(thread.satisfaction_score) }}>
                        {thread.satisfaction_score}/10
                      </div>
                      {thread.satisfaction_analysis && isExpanded && (
                        <span class="mail-satisfaction-analysis">{thread.satisfaction_analysis}</span>
                      )}
                    </div>
                  )}

                  <div class="mail-footer">
                    <span class="mail-time">{formatRelativeTime(thread.last_message_date)}</span>
                    <div class="mail-actions">
                      <button
                        class="mail-action-btn"
                        onClick={(e) => handleArchive(thread.id, e)}
                        title="Archive this thread (removes from inbox)"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                          <polyline points="21 8 21 21 3 21 3 8"/>
                          <rect x="1" y="3" width="22" height="5"/>
                          <line x1="10" y1="12" x2="14" y2="12"/>
                        </svg>
                        Archive
                      </button>
                      <button
                        class="mail-action-btn"
                        onClick={(e) => handleToggleRead(thread.id, thread.is_unread, e)}
                        title={thread.is_unread ? 'Mark as read' : 'Mark as unread'}
                      >
                        {thread.is_unread ? 'Mark read' : 'Mark unread'}
                      </button>
                      <button
                        class="mail-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://mail.google.com/mail/u/0/#inbox/${thread.gmail_thread_id}`, '_blank');
                        }}
                      >
                        Open in Gmail
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded view with action items */}
                {isExpanded && thread.action_items && thread.action_items.length > 0 && (
                  <div class="mail-action-items">
                    <h4 class="mail-action-items-title">Action Items</h4>
                    <ul class="mail-action-items-list">
                      {thread.action_items.map((item, idx) => (
                        <li key={idx} class="mail-action-item">
                          <span class="mail-action-item-description">{item.description}</span>
                          {item.dueDate && (
                            <span class="mail-action-item-due-date">
                              Due: {new Date(item.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          {item.priority && item.priority !== 'medium' && (
                            <span class={`mail-action-item-priority priority-${item.priority}`}>
                              {item.priority}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
