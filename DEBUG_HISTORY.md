# Debug History Duplicates

If you're seeing duplicate URLs in your history, use these debug tools to inspect and fix the issue.

## How to Use Debug Tools

1. **Open Chrome DevTools Console** (F12)
2. Make sure you're on the extension page (new tab or any page)
3. Run the commands below

## Available Commands

### 1. Inspect History (Check for Duplicates)

```javascript
chrome.runtime.sendMessage({ action: 'debugInspectHistory' }, (response) => {
  if (response.success) {
    console.log('=== INSPECTION RESULTS ===');
    console.log('Total items:', response.data.totalItems);
    console.log('Unique URLs:', response.data.uniqueUrls);
    console.log('Duplicate URLs:', response.data.duplicateCount);
    console.log('Total duplicate entries:', response.data.totalDuplicates);
    console.log('Migration completed:', response.data.migrationCompleted);
    console.log('\nFull details:', response.data);
  }
});
```

This will show you:
- How many total history items you have
- How many are duplicates
- Whether the automatic migration has run
- Examples of duplicate URLs

### 2. Force Clean History (Remove All Duplicates)

```javascript
chrome.runtime.sendMessage({ action: 'debugForceCleanHistory' }, (response) => {
  if (response.success) {
    console.log('=== CLEANUP RESULTS ===');
    console.log('Duplicates removed:', response.data.removed);
    console.log('Before:', response.data.before.totalItems, 'items');
    console.log('After:', response.data.after.totalItems, 'items');
  }
});
```

This will:
- Remove all duplicate URLs (keeps the most recent visit)
- Clean tracking parameters from all URLs
- Show before/after stats

### 3. Reset Migration Flag (Re-run Automatic Migration)

```javascript
chrome.runtime.sendMessage({ action: 'debugResetMigration' }, (response) => {
  if (response.success) {
    console.log('Migration flag reset. Reload the extension to run migration again.');
  }
});
```

Then reload the extension (chrome://extensions -> click reload button)

### 4. Delete Individual History Item by ID

```javascript
chrome.runtime.sendMessage({
  action: 'deleteHistoryItem',
  id: 'ITEM_ID_HERE'
}, (response) => {
  if (response.success) {
    console.log('Item deleted successfully');
  }
});
```

### 5. Delete History Item by URL

```javascript
chrome.runtime.sendMessage({
  action: 'deleteHistoryItemByUrl',
  url: 'https://example.com/page'
}, (response) => {
  if (response.success) {
    console.log('Item deleted successfully');
  }
});
```

This will delete all history items matching the cleaned URL (so it handles URLs with different tracking params as the same).

## Quick Fix

If you just want to clean everything quickly:

```javascript
// One-liner to force clean history
chrome.runtime.sendMessage({ action: 'debugForceCleanHistory' }, r => console.log(r.data));
```

## What Causes Duplicates?

1. **Legacy data** - URLs saved before the URL cleaning feature was added
2. **Tracking parameters** - Same URL with different UTM params (e.g., `?utm_source=twitter`)
3. **Migration not run** - The automatic cleanup hasn't run yet (happens on extension install/update)

## Preventing Future Duplicates

The extension now automatically:
- Cleans URLs before saving (removes tracking params)
- Prevents duplicates when saving new URLs
- Runs a one-time migration on install/update

If you're still seeing duplicates after running the force clean, please check the console for any errors.
