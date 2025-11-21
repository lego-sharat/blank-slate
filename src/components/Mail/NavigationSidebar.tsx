export type MailViewType = 'all' | 'escalations' | 'onboarding' | 'support' | 'newsletters' | 'my-todos' | 'waiting' | 'billing';

interface ViewConfig {
  id: MailViewType;
  label: string;
  icon: string;
  description: string;
}

const VIEWS: ViewConfig[] = [
  {
    id: 'all',
    label: 'All Mail',
    icon: '',
    description: 'All email threads',
  },
  {
    id: 'escalations',
    label: 'Escalations',
    icon: '',
    description: 'High-priority urgent threads',
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    icon: '',
    description: 'New customer onboarding',
  },
  {
    id: 'support',
    label: 'Support',
    icon: '',
    description: 'Customer support requests',
  },
  {
    id: 'newsletters',
    label: 'Newsletters',
    icon: '',
    description: 'Marketing and newsletters',
  },
  {
    id: 'my-todos',
    label: 'My Todos',
    icon: '',
    description: 'Action items for your team',
  },
  {
    id: 'waiting',
    label: 'Waiting',
    icon: '',
    description: 'Waiting on customer',
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: '',
    description: 'Billing links sent to customers',
  },
];

interface NavigationSidebarProps {
  currentView: MailViewType;
  onViewChange: (view: MailViewType) => void;
  viewCounts: Partial<Record<MailViewType, number>>;
}

export default function NavigationSidebar({ currentView, onViewChange, viewCounts }: NavigationSidebarProps) {
  return (
    <nav class="mail-navigation">
      <div class="mail-nav-header">
        <h2 class="mail-nav-title">Mail Views</h2>
      </div>

      <div class="mail-nav-list">
        {VIEWS.map(view => {
          const count = viewCounts[view.id] || 0;
          const isActive = currentView === view.id;

          return (
            <button
              key={view.id}
              class={`mail-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onViewChange(view.id)}
              title={view.description}
            >
              <span class="mail-nav-label">{view.label}</span>
              {count > 0 && (
                <span class="mail-nav-count">{count > 99 ? '99+' : count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div class="mail-nav-footer">
        <div class="mail-nav-stats">
          <div class="mail-stat-item">
            <span class="mail-stat-label">Total</span>
            <span class="mail-stat-value">{viewCounts.all || 0}</span>
          </div>
          <div class="mail-stat-item">
            <span class="mail-stat-label">Unread</span>
            <span class="mail-stat-value">
              {Object.entries(viewCounts)
                .filter(([key]) => key !== 'all')
                .reduce((sum, [, count]) => sum + count, 0)}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
