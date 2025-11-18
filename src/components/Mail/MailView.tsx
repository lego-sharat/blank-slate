import { useState, useEffect } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import { mailMessages, settings } from '@/store/store';
import type { MailMessage } from '@/types';
import {
  getSummaryFromCache,
  getActionItemsFromCache,
  type MailSummaryDB,
  type MailActionItemDB,
} from '@/utils/mailIndexedDB';
import {
  markMessageAsRead,
  completeActionItemInSupabase,
  checkGmailConnection,
} from '@/utils/mailSupabaseSync';

interface MailWithDetails extends MailMessage {
  summary?: string;
  actionItems?: MailActionItemDB[];
}

export default function MailView() {
  const [filter, setFilter] = useState<'all' | 'onboarding' | 'support'>('all');
  const [expandedMailId, setExpandedMailId] = useState<string | null>(null);
  const [mailDetails, setMailDetails] = useState<Record<string, { summary?: string; actionItems?: MailActionItemDB[] }>>({});
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const mails = useComputed(() => mailMessages.value);

  // Check Gmail connection status on mount
  useEffect(() => {
    checkGmailConnection().then((status) => {
      setIsConnected(status.connected);
    });
  }, []);

  const getFilteredMails = (): MailMessage[] => {
    let filtered: MailMessage[];
    switch (filter) {
      case 'all':
        filtered = mails.value.all;
        break;
      case 'onboarding':
        filtered = mails.value.onboarding;
        break;
      case 'support':
        filtered = mails.value.support;
        break;
      default:
        filtered = [];
    }
    return filtered.slice(0, 50);
  };

  // Load summary and action items when mail is expanded
  const toggleExpand = async (mailId: string) => {
    if (expandedMailId === mailId) {
      setExpandedMailId(null);
      return;
    }

    setExpandedMailId(mailId);

    // Load details from IndexedDB if not already loaded
    if (!mailDetails[mailId]) {
      const [summary, actionItems] = await Promise.all([
        getSummaryFromCache(mailId),
        getActionItemsFromCache(mailId),
      ]);

      setMailDetails({
        ...mailDetails,
        [mailId]: {
          summary: summary?.summary,
          actionItems: actionItems || [],
        },
      });
    }
  };

  // Toggle action item completion
  const handleToggleActionItem = async (itemId: string, currentStatus: boolean, e: Event) => {
    e.stopPropagation();
    const success = await completeActionItemInSupabase(itemId, !currentStatus);
    if (success) {
      // Refresh mail details to show updated status
      const mailId = expandedMailId;
      if (mailId) {
        const actionItems = await getActionItemsFromCache(mailId);
        setMailDetails({
          ...mailDetails,
          [mailId]: {
            ...mailDetails[mailId],
            actionItems: actionItems || [],
          },
        });
      }
    }
  };

  // Toggle read/unread status
  const handleToggleRead = async (mailId: string, currentUnreadStatus: boolean, e: Event) => {
    e.stopPropagation();
    await markMessageAsRead(mailId, currentUnreadStatus);
    // The background sync will update the cache
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

  const getCategoryBadgeClass = (category?: string): string => {
    if (category === 'onboarding') return 'mail-badge-onboarding';
    if (category === 'support') return 'mail-badge-support';
    return 'mail-badge-general';
  };

  const getCategoryLabel = (category?: string): string => {
    if (category === 'onboarding') return 'Onboarding';
    if (category === 'support') return 'Support';
    return '';
  };

  const filteredMails = getFilteredMails();

  return (
    <div class="mail-view">
      <div class="mail-header">
        <h1 class="mail-title">Mail</h1>
        <div class="mail-header-actions">
          <span class="mail-stats">{filteredMails.length} messages</span>
          <button class="mail-view-all-button" onClick={handleViewAll}>
            Open Gmail
          </button>
        </div>
      </div>

      <div class="mail-filters">
        <button
          class={`mail-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Mail
          {mails.value.all.length > 0 && (
            <span class="mail-filter-count">{mails.value.all.length}</span>
          )}
        </button>
        <button
          class={`mail-filter-btn ${filter === 'onboarding' ? 'active' : ''}`}
          onClick={() => setFilter('onboarding')}
        >
          Onboarding
          {mails.value.onboarding.length > 0 && (
            <span class="mail-filter-count">{mails.value.onboarding.length}</span>
          )}
        </button>
        <button
          class={`mail-filter-btn ${filter === 'support' ? 'active' : ''}`}
          onClick={() => setFilter('support')}
        >
          Support
          {mails.value.support.length > 0 && (
            <span class="mail-filter-count">{mails.value.support.length}</span>
          )}
        </button>
      </div>

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

      {filteredMails.length === 0 ? (
        <div class="mail-empty-state">
          <p>{isConnected ? 'No messages found.' : 'Connect Gmail to see your emails here.'}</p>
        </div>
      ) : (
        <div class="mail-list">
          {filteredMails.map(mail => {
            const isExpanded = expandedMailId === mail.id;
            const details = mailDetails[mail.id];

            return (
              <div
                key={mail.id}
                class={`mail-item ${mail.isUnread ? 'unread' : ''} ${isExpanded ? 'expanded' : ''}`}
              >
                <div class="mail-item-content" onClick={() => toggleExpand(mail.id)}>
                  <div class="mail-item-header">
                    <div class="mail-from">
                      <span class="mail-sender-name">{mail.from.name || mail.from.email}</span>
                      {mail.isUnread && <span class="mail-unread-dot"></span>}
                    </div>
                    <div class="mail-badges">
                      {mail.category && mail.category !== 'general' && (
                        <span class={`mail-badge ${getCategoryBadgeClass(mail.category)}`}>
                          {getCategoryLabel(mail.category)}
                        </span>
                      )}
                      {mail.hasAttachments && (
                        <span class="mail-attachment-icon" title="Has attachments">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                          </svg>
                        </span>
                      )}
                    </div>
                  </div>

                  <div class="mail-subject">{mail.subject || '(No subject)'}</div>

                  {/* Show AI summary if available */}
                  {details?.summary && (
                    <div class="mail-ai-summary">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4"/>
                        <path d="M12 8h.01"/>
                      </svg>
                      <span>{details.summary}</span>
                    </div>
                  )}

                  {!isExpanded && <div class="mail-snippet">{mail.snippet}</div>}

                  <div class="mail-footer">
                    <span class="mail-time">{formatRelativeTime(mail.date)}</span>
                    <div class="mail-actions">
                      <button
                        class="mail-action-btn"
                        onClick={(e) => handleToggleRead(mail.id, mail.isUnread, e)}
                        title={mail.isUnread ? 'Mark as read' : 'Mark as unread'}
                      >
                        {mail.isUnread ? 'Mark read' : 'Mark unread'}
                      </button>
                      <button
                        class="mail-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://mail.google.com/mail/u/0/#inbox/${mail.threadId}`, '_blank');
                        }}
                      >
                        Open in Gmail
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded view with action items */}
                {isExpanded && details?.actionItems && details.actionItems.length > 0 && (
                  <div class="mail-action-items">
                    <h4 class="mail-action-items-title">Action Items</h4>
                    <ul class="mail-action-items-list">
                      {details.actionItems.map((item) => (
                        <li key={item.id} class={`mail-action-item ${item.is_completed ? 'completed' : ''}`}>
                          <label class="mail-action-item-checkbox">
                            <input
                              type="checkbox"
                              checked={item.is_completed}
                              onChange={(e) => handleToggleActionItem(item.id, item.is_completed, e)}
                            />
                            <span class="mail-action-item-description">{item.description}</span>
                          </label>
                          {item.due_date && (
                            <span class="mail-action-item-due-date">
                              Due: {new Date(item.due_date).toLocaleDateString()}
                            </span>
                          )}
                          {item.priority !== 'medium' && (
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
