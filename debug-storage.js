/**
 * Debug script to check Supabase storage state
 *
 * Run this in the browser console (extension context):
 * - Chrome: Right-click extension icon → Inspect popup → Console tab
 * - Or: chrome://extensions → Your extension → Inspect views: service worker
 */

(async function debugStorage() {
  console.log('=== Supabase Storage Debug ===\n');

  // Get all storage
  const storage = await chrome.storage.local.get(null);

  // 1. Check settings
  console.log('1️⃣ Settings:');
  if (storage.settings) {
    console.log('  ✅ settings object exists');
    console.log('  - supabaseUrl:', storage.settings.supabaseUrl ? '✅ Set' : '❌ Missing');
    console.log('  - supabaseKey:', storage.settings.supabaseKey ? '✅ Set' : '❌ Missing');
  } else {
    console.log('  ❌ No settings object found');
  }

  // 2. Check for Supabase session keys
  console.log('\n2️⃣ Session Keys:');
  const sessionKeys = Object.keys(storage).filter(key =>
    key.startsWith('sb-') && key.endsWith('-auth-token') || key === 'supabaseSession'
  );

  if (sessionKeys.length === 0) {
    console.log('  ❌ No session keys found');
    console.log('  → You need to sign in to create a session');
  } else {
    sessionKeys.forEach(key => {
      const data = storage[key];
      let session = data;

      try {
        if (typeof data === 'string') {
          session = JSON.parse(data);
        }
      } catch (e) {
        console.log(`  ⚠️  ${key}: Failed to parse`);
        return;
      }

      console.log(`  ✅ ${key}:`);
      console.log('    - User ID:', session.user?.id || '❌ Missing');
      console.log('    - Email:', session.user?.email || '❌ Missing');
      console.log('    - Access Token:', session.access_token ? `✅ ${session.access_token.substring(0, 20)}...` : '❌ Missing');
      console.log('    - Expires At:', session.expires_at || '❌ Missing');
    });
  }

  // 3. Check all storage keys
  console.log('\n3️⃣ All Storage Keys:');
  console.log(Object.keys(storage).sort());

  // 4. Diagnosis
  console.log('\n4️⃣ Diagnosis:');
  const hasSettings = storage.settings?.supabaseUrl && storage.settings?.supabaseKey;
  const hasSession = storage.supabaseSession?.access_token;
  const hasOldSession = Object.keys(storage).some(key =>
    key.startsWith('sb-') && key.endsWith('-auth-token')
  );

  if (!hasSettings) {
    console.log('  ❌ Supabase credentials not configured');
    console.log('  → Go to Settings and configure your Supabase URL and Key');
  } else if (!hasSession && !hasOldSession) {
    console.log('  ❌ No session found');
    console.log('  → Sign in with Google to create a session');
  } else if (!hasSession && hasOldSession) {
    console.log('  ⚠️  Old session format detected');
    console.log('  → Run migrate-session.js to migrate, OR');
    console.log('  → Sign out and sign back in to create new session');
  } else if (hasSession) {
    console.log('  ✅ Everything looks good!');
    console.log('  → If sync still fails, check the console for error messages');
  }

  console.log('\n=== End Debug ===');
})();
