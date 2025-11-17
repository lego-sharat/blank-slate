import type { HistoryItem, HistoryItemType } from '@/types';

/**
 * Configuration for tracking different platforms
 */
const TRACKED_DOMAINS = {
  'docs.google.com': 'google-docs',
  'notion.so': 'notion',
  'www.notion.so': 'notion',
  'figma.com': 'figma',
  'www.figma.com': 'figma',
  'github.com': 'github', // Will determine repo vs issue from URL
  'linear.app': 'linear',
} as const;

const HISTORY_STORAGE_KEY = 'history_items';

/**
 * Extract title from page
 */
function extractTitle(url: string, pageTitle?: string): string {
  if (pageTitle && pageTitle !== 'undefined') {
    return pageTitle;
  }

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Extract meaningful title from URL
    if (url.includes('docs.google.com/document')) {
      return pageTitle || 'Google Doc';
    } else if (url.includes('docs.google.com/spreadsheets')) {
      return pageTitle || 'Google Sheet';
    } else if (url.includes('docs.google.com/presentation')) {
      return pageTitle || 'Google Slides';
    } else if (url.includes('docs.google.com/forms')) {
      return pageTitle || 'Google Form';
    } else if (url.includes('notion.so')) {
      const parts = pathname.split('/').filter(p => p);
      return parts[parts.length - 1]?.replace(/-/g, ' ') || 'Notion Page';
    } else if (url.includes('figma.com/file')) {
      const parts = pathname.split('/');
      return parts[3]?.replace(/-/g, ' ') || 'Figma File';
    } else if (url.includes('figma.com/board') || url.includes('figjam')) {
      const parts = pathname.split('/');
      return parts[3]?.replace(/-/g, ' ') || 'FigJam Board';
    } else if (url.includes('github.com')) {
      const parts = pathname.split('/').filter(p => p);
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
      return 'GitHub';
    } else if (url.includes('linear.app')) {
      return 'Linear Issue';
    }
  } catch (e) {
    console.error('Error extracting title:', e);
  }

  return url;
}

/**
 * Determine the type of history item from URL
 */
function determineType(url: string): HistoryItemType | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;

    // Check if it's a tracked domain
    const baseType = TRACKED_DOMAINS[hostname as keyof typeof TRACKED_DOMAINS];
    if (!baseType) return null;

    // Special handling for GitHub
    if (baseType === 'github') {
      if (pathname.includes('/issues/')) {
        return 'github-issue';
      } else if (pathname.match(/^\/[^\/]+\/[^\/]+\/?$/)) {
        return 'github-repo';
      }
      return null; // Other GitHub pages we don't track
    }

    // Special handling for Figma vs FigJam
    if (baseType === 'figma') {
      // FigJam uses /board/ in the path or has figjam in the URL
      if (pathname.includes('/board/') || url.includes('figjam')) {
        return 'figjam';
      }
      // Regular Figma files use /file/
      if (pathname.includes('/file/')) {
        return 'figma';
      }
      return null;
    }

    return baseType as HistoryItemType;
  } catch (e) {
    return null;
  }
}

/**
 * Check if URL should be tracked
 */
export function shouldTrackUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check if domain is tracked
    if (!(hostname in TRACKED_DOMAINS)) {
      return false;
    }

    // Additional filtering
    // Track all Google Docs apps: Docs, Sheets, Slides, Forms
    if (url.includes('docs.google.com/document')) return true;
    if (url.includes('docs.google.com/spreadsheets')) return true;
    if (url.includes('docs.google.com/presentation')) return true;
    if (url.includes('docs.google.com/forms')) return true;

    if (url.includes('notion.so') && !url.includes('/login')) return true;
    if (url.includes('figma.com/file')) return true;
    if (url.includes('figma.com/board') || url.includes('figjam')) return true;
    if (url.includes('github.com')) {
      const type = determineType(url);
      return type === 'github-repo' || type === 'github-issue';
    }
    if (url.includes('linear.app/') && url.match(/linear\.app\/[^\/]+\/issue/)) return true;

    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Create a history item from URL and title
 */
export function createHistoryItem(url: string, title?: string): HistoryItem | null {
  if (!shouldTrackUrl(url)) {
    return null;
  }

  const type = determineType(url);
  if (!type) {
    return null;
  }

  return {
    id: `${url}-${Date.now()}`,
    type,
    title: extractTitle(url, title),
    url,
    visitedAt: Date.now(),
  };
}

/**
 * Get history items from chrome.storage
 */
export async function getHistoryItems(): Promise<HistoryItem[]> {
  try {
    const result = await chrome.storage.local.get(HISTORY_STORAGE_KEY);
    const items = result[HISTORY_STORAGE_KEY];
    return Array.isArray(items) ? items : [];
  } catch (e) {
    console.error('Error loading history items:', e);
    return [];
  }
}

/**
 * Save history item to chrome.storage
 */
export async function saveHistoryItem(item: HistoryItem): Promise<void> {
  try {
    let items = await getHistoryItems();

    // Check if this URL already exists (regardless of when it was visited)
    const existingIndex = items.findIndex(i => i.url === item.url);

    if (existingIndex !== -1) {
      // Remove the existing item from its current position
      items.splice(existingIndex, 1);
    }

    // Add the new/updated item at the beginning (most recent first)
    items.unshift(item);

    // Keep only last 100 items total
    const trimmed = items.slice(0, 100);

    await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: trimmed });
  } catch (e) {
    console.error('Error saving history item:', e);
  }
}

/**
 * Update title for an existing history item
 */
export async function updateHistoryItemTitle(url: string, newTitle: string): Promise<void> {
  try {
    const items = await getHistoryItems();

    // Find the most recent item with this URL
    const item = items.find(i => i.url === url);

    if (item && newTitle && newTitle !== 'undefined') {
      item.title = newTitle;
      await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: items });
    }
  } catch (e) {
    console.error('Error updating history item title:', e);
  }
}

/**
 * Get history items by type, limited to count
 */
export async function getHistoryByType(type: HistoryItemType, limit: number = 10): Promise<HistoryItem[]> {
  const items = await getHistoryItems();
  return items
    .filter(item => item.type === type)
    .sort((a, b) => b.visitedAt - a.visitedAt)
    .slice(0, limit);
}

/**
 * Get all history items chronologically, limited to count
 */
export async function getAllHistory(limit: number = 50): Promise<HistoryItem[]> {
  const items = await getHistoryItems();
  return items
    .sort((a, b) => b.visitedAt - a.visitedAt)
    .slice(0, limit);
}

/**
 * Search history items
 */
export async function searchHistory(query: string): Promise<HistoryItem[]> {
  if (!query.trim()) {
    const items = await getHistoryItems();
    return items.slice(0, 50);
  }

  const items = await getHistoryItems();
  const lowerQuery = query.toLowerCase();

  return items.filter(item =>
    item.title.toLowerCase().includes(lowerQuery) ||
    item.url.toLowerCase().includes(lowerQuery)
  ).slice(0, 50);
}

/**
 * Clear all history
 */
export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(HISTORY_STORAGE_KEY);
}

/**
 * Clear history by type
 */
export async function clearHistoryByType(type: HistoryItemType): Promise<void> {
  const items = await getHistoryItems();
  const filtered = items.filter(item => item.type !== type);
  await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: filtered });
}
