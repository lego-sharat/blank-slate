import { useState, useEffect } from 'preact/hooks';
import type { HistoryItem, HistoryItemType } from '@/types';
import { getHistoryByType, searchHistory } from '@/utils/historyTracker';

export default function HistoryView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | HistoryItemType>('all');
  const [historyData, setHistoryData] = useState<{
    googleDocs: HistoryItem[];
    notion: HistoryItem[];
    figma: HistoryItem[];
    figjam: HistoryItem[];
    githubRepos: HistoryItem[];
    githubIssues: HistoryItem[];
    linear: HistoryItem[];
  }>({
    googleDocs: [],
    notion: [],
    figma: [],
    figjam: [],
    githubRepos: [],
    githubIssues: [],
    linear: [],
  });
  const [searchResults, setSearchResults] = useState<HistoryItem[]>([]);

  // Load history data
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    setHistoryData({
      googleDocs: getHistoryByType('google-docs', 10),
      notion: getHistoryByType('notion', 10),
      figma: getHistoryByType('figma', 10),
      figjam: getHistoryByType('figjam', 10),
      githubRepos: getHistoryByType('github-repo', 10),
      githubIssues: getHistoryByType('github-issue', 10),
      linear: getHistoryByType('linear', 10),
    });
  };

  // Handle search
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchHistory(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
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
      'notion': '#000000',
      'figma': '#f24e1e',
      'figjam': '#a259ff',
      'github-repo': '#238636',
      'github-issue': '#f85149',
      'linear': '#5e6ad2',
    };
    return colors[type];
  };

  const renderHistorySection = (title: string, items: HistoryItem[], type: HistoryItemType) => {
    if (items.length === 0) return null;

    return (
      <div class="history-section">
        <div class="history-section-header">
          <h3 class="history-section-title">{title}</h3>
          <span class="history-section-count">{items.length}</span>
        </div>

        <div class="history-items-list">
          {items.map(item => (
            <div
              key={item.id}
              class="history-item"
              onClick={() => window.open(item.url, '_blank')}
            >
              <div class="history-item-header">
                <span
                  class="history-item-type-badge"
                  style={{ backgroundColor: `${getTypeColor(type)}20`, color: getTypeColor(type) }}
                >
                  {getTypeLabel(type)}
                </span>
                <span class="history-item-time">{formatTimeAgo(item.visitedAt)}</span>
              </div>

              <div class="history-item-title">{item.title}</div>

              <div class="history-item-url">{item.url}</div>
            </div>
          ))}
        </div>
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

            {searchResults.length === 0 ? (
              <div class="history-empty-state">No results found</div>
            ) : (
              <div class="history-items-list">
                {searchResults.map(item => (
                  <div
                    key={item.id}
                    class="history-item"
                    onClick={() => window.open(item.url, '_blank')}
                  >
                    <div class="history-item-header">
                      <span
                        class="history-item-type-badge"
                        style={{ backgroundColor: `${getTypeColor(item.type)}20`, color: getTypeColor(item.type) }}
                      >
                        {getTypeLabel(item.type)}
                      </span>
                      <span class="history-item-time">{formatTimeAgo(item.visitedAt)}</span>
                    </div>

                    <div class="history-item-title">{item.title}</div>

                    <div class="history-item-url">{item.url}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Sections */}
      {!searchQuery.trim() && (
        <div class="history-content">
          {(activeFilter === 'all' || activeFilter === 'google-docs') && renderHistorySection('Google Docs', historyData.googleDocs, 'google-docs')}
          {(activeFilter === 'all' || activeFilter === 'notion') && renderHistorySection('Notion', historyData.notion, 'notion')}
          {(activeFilter === 'all' || activeFilter === 'figma') && renderHistorySection('Figma', historyData.figma, 'figma')}
          {(activeFilter === 'all' || activeFilter === 'figjam') && renderHistorySection('FigJam', historyData.figjam, 'figjam')}
          {(activeFilter === 'all' || activeFilter === 'github-repo') && renderHistorySection('GitHub Repositories', historyData.githubRepos, 'github-repo')}
          {(activeFilter === 'all' || activeFilter === 'github-issue') && renderHistorySection('GitHub Issues', historyData.githubIssues, 'github-issue')}
          {(activeFilter === 'all' || activeFilter === 'linear') && renderHistorySection('Linear', historyData.linear, 'linear')}
        </div>
      )}
    </div>
  );
}
