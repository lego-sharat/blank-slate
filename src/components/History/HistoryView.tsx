import { useState, useEffect } from 'preact/hooks';
import type { HistoryItem, HistoryItemType } from '@/types';
import { getAllHistory, getHistoryByType, searchHistory } from '@/utils/historyTracker';

export default function HistoryView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | HistoryItemType>('all');
  const [filteredItems, setFilteredItems] = useState<HistoryItem[]>([]);
  const [searchResults, setSearchResults] = useState<HistoryItem[]>([]);

  // Load history data
  useEffect(() => {
    loadHistory();
  }, []);

  // Update filtered items when filter changes
  useEffect(() => {
    if (activeFilter === 'all') {
      loadAllHistory();
    } else {
      loadFilteredHistory(activeFilter);
    }
  }, [activeFilter]);

  const loadHistory = async () => {
    if (activeFilter === 'all') {
      await loadAllHistory();
    } else {
      await loadFilteredHistory(activeFilter);
    }
  };

  const loadAllHistory = async () => {
    const items = await getAllHistory(50);
    setFilteredItems(items);
  };

  const loadFilteredHistory = async (type: HistoryItemType) => {
    const items = await getHistoryByType(type, 10);
    setFilteredItems(items);
  };

  // Handle search
  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.trim()) {
        const results = await searchHistory(searchQuery);
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    };

    performSearch();
  }, [searchQuery]);

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
      'linear': 'Linear',
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
      'linear': '#81a2be',
    };
    return colors[type];
  };

  const handleItemClick = (url: string) => {
    window.location.href = url;
  };

  const renderHistoryItems = (items: HistoryItem[], showBadges: boolean) => {
    if (items.length === 0) {
      return <div class="history-empty-state">No history items found</div>;
    }

    return (
      <div class="history-items-list">
        {items.map(item => (
          <div
            key={item.id}
            class="history-item"
            onClick={() => handleItemClick(item.url)}
          >
            <div class="history-item-header">
              {showBadges && (
                <span
                  class="history-item-type-badge"
                  style={{ backgroundColor: `${getTypeColor(item.type)}20`, color: getTypeColor(item.type) }}
                >
                  {getTypeLabel(item.type)}
                </span>
              )}
              <span class="history-item-time">{formatTimeAgo(item.visitedAt)}</span>
            </div>

            <div class="history-item-title">{item.title}</div>

            <div class="history-item-url">{item.url}</div>
          </div>
        ))}
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
        <button
          class={`history-filter-btn ${activeFilter === 'linear' ? 'active' : ''}`}
          onClick={() => setActiveFilter('linear')}
        >
          Linear
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
