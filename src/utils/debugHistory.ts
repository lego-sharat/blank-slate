import { getHistoryItems } from './historyTracker';
import { cleanUrl } from './urlCleaner';
import { cleanAndDeduplicateHistory } from './cleanHistory';

/**
 * Debug utility to inspect and fix history duplicates
 * Can be called from browser console via chrome.runtime.sendMessage
 */

/**
 * Get detailed stats about history including duplicates
 */
export async function inspectHistory() {
  const items = await getHistoryItems();

  console.log('=== HISTORY INSPECTION ===');
  console.log('Total items:', items.length);

  // Group by cleaned URL
  const urlCounts = new Map<string, number>();
  const urlExamples = new Map<string, string[]>();

  for (const item of items) {
    const cleaned = cleanUrl(item.url);
    urlCounts.set(cleaned, (urlCounts.get(cleaned) || 0) + 1);

    if (!urlExamples.has(cleaned)) {
      urlExamples.set(cleaned, []);
    }
    urlExamples.get(cleaned)!.push(item.url);
  }

  // Find duplicates
  const duplicates: Array<{ cleanedUrl: string; count: number; examples: string[] }> = [];
  urlCounts.forEach((count, url) => {
    if (count > 1) {
      duplicates.push({
        cleanedUrl: url,
        count,
        examples: urlExamples.get(url) || [],
      });
    }
  });

  console.log('\n=== DUPLICATES FOUND ===');
  console.log('Unique URLs with duplicates:', duplicates.length);
  console.log('Total duplicate entries:', duplicates.reduce((sum, d) => sum + (d.count - 1), 0));

  if (duplicates.length > 0) {
    console.log('\n=== SAMPLE DUPLICATES (first 5) ===');
    duplicates.slice(0, 5).forEach((dup, i) => {
      console.log(`\n${i + 1}. Cleaned URL: ${dup.cleanedUrl}`);
      console.log(`   Count: ${dup.count}`);
      console.log('   Raw URLs:');
      dup.examples.forEach(ex => console.log(`     - ${ex}`));
    });
  }

  // Check migration flag
  const migrationResult = await chrome.storage.local.get('history_cleaned_v1');
  console.log('\n=== MIGRATION STATUS ===');
  console.log('Migration completed:', !!migrationResult.history_cleaned_v1);

  return {
    totalItems: items.length,
    uniqueUrls: urlCounts.size,
    duplicateCount: duplicates.length,
    totalDuplicates: duplicates.reduce((sum, d) => sum + (d.count - 1), 0),
    migrationCompleted: !!migrationResult.history_cleaned_v1,
    duplicates,
  };
}

/**
 * Force cleanup of history (ignores migration flag)
 */
export async function forceCleanHistory() {
  console.log('=== FORCING HISTORY CLEANUP ===');

  const beforeStats = await inspectHistory();

  console.log('\n=== RUNNING CLEANUP ===');
  const result = await cleanAndDeduplicateHistory();

  console.log('\n=== CLEANUP COMPLETE ===');
  console.log('Original count:', result.originalCount);
  console.log('Cleaned count:', result.cleanedCount);
  console.log('Duplicates removed:', result.duplicatesRemoved);

  const afterStats = await inspectHistory();

  return {
    before: beforeStats,
    after: afterStats,
    removed: result.duplicatesRemoved,
  };
}

/**
 * Reset migration flag to allow re-running
 */
export async function resetMigrationFlag() {
  await chrome.storage.local.remove('history_cleaned_v1');
  console.log('Migration flag reset. Restart the extension to run migration again.');
}
