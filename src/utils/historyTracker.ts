import type { HistoryItem, HistoryItemType } from '@/types';
import { cleanUrl, isFigmaFileUrl } from './urlCleaner';
import { getFigmaTitle } from './figmaApi';

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
 * Extract title from page (synchronous version for non-Figma URLs)
 */
function extractTitle(url: string, pageTitle?: string): string {
  // Always prefer the browser's page title if available and valid
  if (pageTitle && pageTitle !== 'undefined' && pageTitle.trim() !== '') {
    // Clean up Figma page titles by removing " - Figma" or " – Figma" suffix
    if (url.includes('figma.com')) {
      return pageTitle.replace(/\s+[-–]\s+Figma\s*$/i, '').trim();
    }
    return pageTitle;
  }

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Extract meaningful title from URL as fallback
    if (url.includes('docs.google.com/document')) {
      return 'Google Doc';
    } else if (url.includes('docs.google.com/spreadsheets')) {
      return 'Google Sheet';
    } else if (url.includes('docs.google.com/presentation')) {
      return 'Google Slides';
    } else if (url.includes('docs.google.com/forms')) {
      return 'Google Form';
    } else if (url.includes('notion.so')) {
      const parts = pathname.split('/').filter(p => p);
      return parts[parts.length - 1]?.replace(/-/g, ' ') || 'Notion Page';
    } else if (url.includes('figma.com/file') || url.includes('figma.com/design')) {
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
 * Extract enhanced title from page (async version that uses Figma API only as fallback)
 */
async function extractTitleAsync(url: string, pageTitle?: string): Promise<string> {
  // First, try to get title from the browser (just like Notion)
  const browserTitle = extractTitle(url, pageTitle);

  // For Figma URLs with node IDs, try to enhance with API to get "File - Node" format
  // Only use API if:
  // 1. We have a node ID in the URL (user is viewing a specific frame/component)
  // 2. Browser title doesn't already include node name
  if (isFigmaFileUrl(url)) {
    const { extractFigmaNodeId } = await import('./urlCleaner');
    const nodeId = extractFigmaNodeId(url);

    // Only call API if we have a node ID and the browser title doesn't include " - "
    // (which would indicate it already has "File - Node" format)
    if (nodeId && !browserTitle.includes(' - ')) {
      try {
        const figmaTitle = await getFigmaTitle(url, browserTitle);
        return figmaTitle;
      } catch (e) {
        console.log('[History Tracker] Figma API unavailable, using browser title:', browserTitle);
        // Fall back to browser title
      }
    }
  }

  // For all other cases, use the browser title
  return browserTitle;
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
      // Regular Figma files use /file/ or /design/
      if (pathname.includes('/file/') || pathname.includes('/design/')) {
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
      console.log('[History Tracker] Domain not tracked:', hostname);
      return false;
    }

    // Additional filtering
    // Track all Google Docs apps: Docs, Sheets, Slides, Forms
    if (url.includes('docs.google.com/document')) return true;
    if (url.includes('docs.google.com/spreadsheets')) return true;
    if (url.includes('docs.google.com/presentation')) return true;
    if (url.includes('docs.google.com/forms')) return true;

    if (url.includes('notion.so') && !url.includes('/login')) return true;

    // Figma tracking
    if (url.includes('figma.com/file') || url.includes('figma.com/design')) {
      console.log('[History Tracker] Figma file URL detected:', url);
      return true;
    }
    if (url.includes('figma.com/board') || url.includes('figjam')) {
      console.log('[History Tracker] FigJam board URL detected:', url);
      return true;
    }

    if (url.includes('github.com')) {
      const type = determineType(url);
      return type === 'github-repo' || type === 'github-issue';
    }
    if (url.includes('linear.app/') && url.match(/linear\.app\/[^\/]+\/issue/)) return true;

    console.log('[History Tracker] URL not matching any pattern:', url);
    return false;
  } catch (e) {
    console.error('[History Tracker] Error in shouldTrackUrl:', e);
    return false;
  }
}

/**
 * Create a history item from URL and title (synchronous version)
 */
export function createHistoryItem(url: string, title?: string): HistoryItem | null {
  if (!shouldTrackUrl(url)) {
    return null;
  }

  const type = determineType(url);
  if (!type) {
    return null;
  }

  // Clean the URL before storing
  const cleanedUrl = cleanUrl(url);

  return {
    id: `${cleanedUrl}-${Date.now()}`,
    type,
    title: extractTitle(url, title),
    url: cleanedUrl,
    visitedAt: Date.now(),
  };
}

/**
 * Create a history item from URL and title (async version with Figma API support)
 */
export async function createHistoryItemAsync(url: string, title?: string): Promise<HistoryItem | null> {
  console.log('[History Tracker] createHistoryItemAsync called with URL:', url);

  if (!shouldTrackUrl(url)) {
    console.log('[History Tracker] URL not tracked, skipping');
    return null;
  }

  const type = determineType(url);
  if (!type) {
    console.log('[History Tracker] Could not determine type for URL:', url);
    return null;
  }

  console.log('[History Tracker] URL type determined:', type);

  // Clean the URL before storing
  const cleanedUrl = cleanUrl(url);
  console.log('[History Tracker] Cleaned URL:', cleanedUrl);

  // Get enhanced title (uses Figma API for Figma URLs)
  const enhancedTitle = await extractTitleAsync(url, title);
  console.log('[History Tracker] Enhanced title:', enhancedTitle);

  const historyItem = {
    id: `${cleanedUrl}-${Date.now()}`,
    type,
    title: enhancedTitle,
    url: cleanedUrl,
    visitedAt: Date.now(),
  };

  console.log('[History Tracker] Created history item:', historyItem);
  return historyItem;
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

    // Clean the item URL (should already be clean, but just in case)
    const cleanedItemUrl = cleanUrl(item.url);
    item.url = cleanedItemUrl;

    // Check if this URL already exists (regardless of when it was visited)
    // Compare cleaned URLs to handle legacy items with tracking params
    const existingIndex = items.findIndex(i => {
      const cleanedExistingUrl = cleanUrl(i.url);
      return cleanedExistingUrl === cleanedItemUrl;
    });

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

    // Clean the URL to match against cleaned items
    const cleanedUrl = cleanUrl(url);

    // Find the most recent item with this URL (compare cleaned URLs)
    const item = items.find(i => cleanUrl(i.url) === cleanedUrl);

    if (item && newTitle && newTitle !== 'undefined') {
      item.title = newTitle;
      // Also ensure the URL is cleaned
      item.url = cleanedUrl;
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
 * Delete a single history item by ID
 */
export async function deleteHistoryItem(id: string): Promise<void> {
  try {
    const items = await getHistoryItems();
    const filtered = items.filter(item => item.id !== id);
    await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: filtered });
  } catch (e) {
    console.error('Error deleting history item:', e);
  }
}

/**
 * Delete a history item by URL
 */
export async function deleteHistoryItemByUrl(url: string): Promise<void> {
  try {
    const items = await getHistoryItems();
    const cleanedUrl = cleanUrl(url);
    const filtered = items.filter(item => cleanUrl(item.url) !== cleanedUrl);
    await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: filtered });
  } catch (e) {
    console.error('Error deleting history item by URL:', e);
  }
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
