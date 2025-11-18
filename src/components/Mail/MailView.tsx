import { useState } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import { mailMessages, settings } from '@/store/store';
import type { MailMessage } from '@/types';

export default function MailView() {
  const [filter, setFilter] = useState<'all' | 'onboarding' | 'support'>('all');
  const mails = useComputed(() => mailMessages.value);

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

      {filteredMails.length === 0 ? (
        <div class="mail-empty-state">
          <p>No messages found.</p>
        </div>
      ) : (
        <div class="mail-list">
          {filteredMails.map(mail => (
            <div
              key={mail.id}
              class={`mail-item ${mail.isUnread ? 'unread' : ''}`}
              onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${mail.id}`, '_blank')}
            >
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

              <div class="mail-snippet">{mail.snippet}</div>

              <div class="mail-footer">
                <span class="mail-time">{formatRelativeTime(mail.date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
