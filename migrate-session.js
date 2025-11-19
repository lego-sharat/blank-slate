/**
 * One-time migration script to copy session from old Supabase key format
 * to our consistent 'supabaseSession' key
 *
 * Run this in the browser console (extension context):
 */

(async function migrateSession() {
  console.log('🔍 Checking for existing Supabase session...');

  // Get all keys from storage
  const allStorage = await chrome.storage.local.get(null);
  console.log('All storage keys:', Object.keys(allStorage));

  // Find the Supabase auth token key (starts with 'sb-' and ends with '-auth-token')
  const supabaseKey = Object.keys(allStorage).find(key =>
    key.startsWith('sb-') && key.endsWith('-auth-token')
  );

  if (!supabaseKey) {
    console.log('❌ No Supabase session found in storage');
    console.log('You need to sign in to create a session');
    return;
  }

  console.log('✅ Found Supabase session at key:', supabaseKey);

  // Get the session data
  const sessionData = allStorage[supabaseKey];

  if (!sessionData) {
    console.log('❌ Session key exists but has no data');
    return;
  }

  // Parse the session
  let session;
  try {
    session = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
  } catch (e) {
    console.error('❌ Failed to parse session:', e);
    return;
  }

  console.log('Session data:', {
    hasUser: !!session.user,
    userId: session.user?.id,
    hasAccessToken: !!session.access_token,
    expiresAt: session.expires_at
  });

  // Save to our consistent key
  await chrome.storage.local.set({ supabaseSession: session });
  console.log('✅ Migrated session to supabaseSession key');

  // Verify
  const result = await chrome.storage.local.get('supabaseSession');
  console.log('✅ Verification - supabaseSession exists:', !!result.supabaseSession);

  console.log('\n🎉 Migration complete! Reload the extension to use the migrated session.');
})();
