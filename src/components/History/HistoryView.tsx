import { useState, useEffect, useMemo } from 'preact/hooks';
import type { HistoryItem, HistoryItemType } from '@/types';
import { history } from '@/store/store';

export default function HistoryView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | HistoryItemType>('all');
  const [openTabs, setOpenTabs] = useState<Map<string, number>>(new Map());

  // Filtered items based on activeFilter
  const filteredItems = useMemo(() => {
    const allItems = history.value;

    if (activeFilter === 'all') {
      return allItems.slice(0, 50);
    } else {
      return allItems
        .filter(item => item.type === activeFilter)
        .slice(0, 10);
    }
  }, [history, activeFilter]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    const lowerQuery = searchQuery.toLowerCase();
    return history.value.filter(item =>
      item.title.toLowerCase().includes(lowerQuery) ||
      item.url.toLowerCase().includes(lowerQuery)
    ).slice(0, 50);
  }, [history, searchQuery]);

  // Check open tabs on mount and periodically
  useEffect(() => {
    checkOpenTabs();

    // Refresh open tabs periodically
    const interval = setInterval(checkOpenTabs, 2000);
    return () => clearInterval(interval);
  }, []);

  const checkOpenTabs = async () => {
    try {
      const tabs = await chrome.tabs.query({});
      const tabMap = new Map<string, number>();

      tabs.forEach(tab => {
        if (tab.url && tab.id) {
          tabMap.set(tab.url, tab.id);
        }
      });

      setOpenTabs(tabMap);
    } catch (e) {
      console.error('Error checking open tabs:', e);
    }
  };

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getTypeLabel = (type: HistoryItemType): string => {
    const labels: Record<HistoryItemType, string> = {
      'google-docs': 'Google Docs',
      'notion': 'Notion',
      'figma': 'Figma',
      'figjam': 'FigJam',
      'github-repo': 'GitHub Repo',
      'github-issue': 'GitHub Issue',
    };
    return labels[type];
  };

  const getTypeColor = (type: HistoryItemType): string => {
    const colors: Record<HistoryItemType, string> = {
      'google-docs': '#4285f4',
      'notion': '#ffffff',
      'figma': '#f24e1e',
      'figjam': '#a259ff',
      'github-repo': '#8abeb7',
      'github-issue': '#cc6666',
    };
    return colors[type];
  };

  const handleItemClick = async (url: string) => {
    const tabId = openTabs.get(url);

    if (tabId) {
      // Tab is already open, switch to it
      try {
        await chrome.tabs.update(tabId, { active: true });
        const tab = await chrome.tabs.get(tabId);
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
      } catch (e) {
        // Tab might have been closed, navigate normally
        window.location.href = url;
      }
    } else {
      // Tab not open, navigate to URL
      window.location.href = url;
    }
  };

  const renderHistoryItems = (items: HistoryItem[], showBadges: boolean) => {
    if (items.length === 0) {
      return <div class="history-empty-state">No history items found</div>;
    }

    return (
      <div class="history-items-list">
        {items.map(item => {
          const isOpen = openTabs.has(item.url);

          return (
            <div
              key={item.id}
              class={`history-item ${isOpen ? 'is-open' : ''}`}
              onClick={() => handleItemClick(item.url)}
            >
              <div class="history-item-header">
                <div class="history-item-badges">
                  {showBadges && (
                    <span
                      class="history-item-type-badge"
                      style={{ backgroundColor: `${getTypeColor(item.type)}20`, color: getTypeColor(item.type) }}
                    >
                      {getTypeLabel(item.type)}
                    </span>
                  )}
                  {isOpen && (
                    <span class="history-item-open-badge">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="3" fill="currentColor"/>
                      </svg>
                      Open
                    </span>
                  )}
                </div>
                <span class="history-item-time">{formatTimeAgo(item.visitedAt)}</span>
              </div>

              <div class="history-item-title">{item.title}</div>

              <div class="history-item-url">{item.url}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div class="history-view">
      <div class="history-header">
        <h1 class="history-title">History</h1>
      </div>

      {/* Search Bar */}
      <div class="history-search-container">
        <input
          type="text"
          class="history-search-input"
          placeholder="Search history..."
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
        />
      </div>

      {/* Filter Tabs */}
      <div class="history-filters">
        <button
          class={`history-filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          All
        </button>
        <button
          class={`history-filter-btn ${activeFilter === 'google-docs' ? 'active' : ''}`}
          onClick={() => setActiveFilter('google-docs')}
        >
          Google Docs
        </button>
        <button
          class={`history-filter-btn ${activeFilter === 'notion' ? 'active' : ''}`}
          onClick={() => setActiveFilter('notion')}
        >
          Notion
        </button>
        <button
          class={`history-filter-btn ${activeFilter === 'figma' ? 'active' : ''}`}
          onClick={() => setActiveFilter('figma')}
        >
          Figma
        </button>
        <button
          class={`history-filter-btn ${activeFilter === 'figjam' ? 'active' : ''}`}
          onClick={() => setActiveFilter('figjam')}
        >
          FigJam
        </button>
        <button
          class={`history-filter-btn ${activeFilter === 'github-repo' ? 'active' : ''}`}
          onClick={() => setActiveFilter('github-repo')}
        >
          GitHub Repos
        </button>
        <button
          class={`history-filter-btn ${activeFilter === 'github-issue' ? 'active' : ''}`}
          onClick={() => setActiveFilter('github-issue')}
        >
          GitHub Issues
        </button>
      </div>

      {/* Search Results */}
      {searchQuery.trim() && (
        <div class="history-content">
          <div class="history-section">
            <div class="history-section-header">
              <h3 class="history-section-title">Search Results</h3>
              <span class="history-section-count">{searchResults.length}</span>
            </div>

            {renderHistoryItems(searchResults, true)}
          </div>
        </div>
      )}

      {/* History Items */}
      {!searchQuery.trim() && (
        <div class="history-content">
          <div class="history-section">
            {activeFilter !== 'all' && (
              <div class="history-section-header">
                <h3 class="history-section-title">{getTypeLabel(activeFilter)}</h3>
                <span class="history-section-count">{filteredItems.length}</span>
              </div>
            )}

            {renderHistoryItems(filteredItems, activeFilter === 'all')}
          </div>
        </div>
      )}
    </div>
  );
}
