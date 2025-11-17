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
 * Extract enhanced title from page (async version that uses Figma API for Figma URLs)
 */
async function extractTitleAsync(url: string, pageTitle?: string): Promise<string> {
  // For Figma URLs, try to get the title from the API
  if (isFigmaFileUrl(url)) {
    try {
      const figmaTitle = await getFigmaTitle(url, pageTitle);
      return figmaTitle;
    } catch (e) {
      console.error('Error getting Figma title from API:', e);
      // Fall back to regular title extraction
    }
  }

  // For non-Figma URLs or if Figma API fails, use regular extraction
  return extractTitle(url, pageTitle);
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
    if (url.includes('figma.com/file')) {
      console.log('[History Tracker] Figma file URL detected:', url);
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
    const items = await getHistoryItems();

    // Clean the item URL (should already be clean, but just in case)
    const cleanedItemUrl = cleanUrl(item.url);

    // Check if URL was recently visited (within last 5 minutes)
    // Compare cleaned URLs to handle legacy items with tracking params
    const recentItem = items.find(i => {
      const cleanedExistingUrl = cleanUrl(i.url);
      return cleanedExistingUrl === cleanedItemUrl &&
             (Date.now() - i.visitedAt) < 5 * 60 * 1000;
    });

    if (recentItem) {
      // Update visit time, title, and clean the URL
      recentItem.visitedAt = Date.now();
      recentItem.title = item.title;
      recentItem.url = cleanedItemUrl; // Update to cleaned URL
      await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: items });
      return;
    }

    // Ensure the item URL is cleaned
    item.url = cleanedItemUrl;

    // Add new item at the beginning
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
