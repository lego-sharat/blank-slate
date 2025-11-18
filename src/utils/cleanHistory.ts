import { getHistoryItems } from './historyTracker';
import { cleanUrl } from './urlCleaner';
import type { HistoryItem } from '@/types';

const HISTORY_STORAGE_KEY = 'history_items';

/**
 * Clean all URLs in existing history and remove duplicates
 */
export async function cleanAndDeduplicateHistory(): Promise<{
  originalCount: number;
  cleanedCount: number;
  duplicatesRemoved: number;
}> {
  try {
    const items = await getHistoryItems();
    const originalCount = items.length;

    // Clean all URLs
    const cleanedItems = items.map(item => ({
      ...item,
      url: cleanUrl(item.url),
    }));

    // Deduplicate by URL, keeping the most recent visit
    const urlMap = new Map<string, HistoryItem>();

    for (const item of cleanedItems) {
      const existing = urlMap.get(item.url);

      if (!existing || item.visitedAt > existing.visitedAt) {
        urlMap.set(item.url, item);
      }
    }

    const deduplicatedItems = Array.from(urlMap.values());
    const cleanedCount = deduplicatedItems.length;
    const duplicatesRemoved = originalCount - cleanedCount;

    // Sort by visitedAt (most recent first)
    deduplicatedItems.sort((a, b) => b.visitedAt - a.visitedAt);

    // Save back to storage
    await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: deduplicatedItems });

    console.log('History cleanup complete:', {
      originalCount,
      cleanedCount,
      duplicatesRemoved,
    });

    return {
      originalCount,
      cleanedCount,
      duplicatesRemoved,
    };
  } catch (e) {
    console.error('Error cleaning history:', e);
    throw e;
  }
}

/**
 * Get statistics about current history
 */
export async function getHistoryStats(): Promise<{
  totalItems: number;
  urlsWithTracking: number;
  potentialDuplicates: number;
}> {
  try {
    const items = await getHistoryItems();
    const totalItems = items.length;

    // Check how many URLs have tracking parameters
    let urlsWithTracking = 0;
    for (const item of items) {
      const cleaned = cleanUrl(item.url);
      if (cleaned !== item.url) {
        urlsWithTracking++;
      }
    }

    // Check for potential duplicates (same URL after cleaning)
    const cleanedUrls = items.map(item => cleanUrl(item.url));
    const uniqueUrls = new Set(cleanedUrls);
    const potentialDuplicates = cleanedUrls.length - uniqueUrls.size;

    return {
      totalItems,
      urlsWithTracking,
      potentialDuplicates,
    };
  } catch (e) {
    console.error('Error getting history stats:', e);
    throw e;
  }
}
