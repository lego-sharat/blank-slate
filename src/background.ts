import { shouldTrackUrl, createHistoryItem, saveHistoryItem } from './utils/historyTracker';

/**
 * Background script for tracking browsing history
 */

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  // Only process when the page is completely loaded
  if (changeInfo.status === 'complete' && tab.url) {
    const url = tab.url;

    // Check if we should track this URL
    if (shouldTrackUrl(url)) {
      const historyItem = createHistoryItem(url, tab.title);

      if (historyItem) {
        // Save to chrome.storage
        await saveHistoryItem(historyItem);
        console.log('Tracked visit:', historyItem.title, historyItem.type);
      }
    }
  }
});

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);

    if (tab.url && tab.status === 'complete') {
      const url = tab.url;

      if (shouldTrackUrl(url)) {
        const historyItem = createHistoryItem(url, tab.title);

        if (historyItem) {
          await saveHistoryItem(historyItem);
        }
      }
    }
  } catch (e) {
    console.error('Error tracking tab activation:', e);
  }
});

console.log('History tracking background script loaded');
