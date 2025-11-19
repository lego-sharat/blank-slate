/**
 * Test if the extension can properly read the supabaseSession
 *
 * Copy and paste this in the browser console (service worker context):
 * chrome://extensions -> Your Extension -> Inspect views: service worker
 */

(async function testSessionAccess() {
  console.log('=== Testing Session Access ===\n');

  // Test 1: Can we read supabaseSession?
  console.log('1️⃣ Reading supabaseSession from storage...');
  const result = await chrome.storage.local.get('supabaseSession');

  if (!result.supabaseSession) {
    console.log('❌ supabaseSession not found in storage');
    console.log('   This is the problem! The session needs to be at this key.');
    return;
  }

  console.log('✅ supabaseSession exists');

  // Test 2: Check structure
  console.log('\n2️⃣ Checking session structure...');
  const session = result.supabaseSession;

  console.log('   - Type:', typeof session);
  console.log('   - Has access_token:', !!session.access_token);
  console.log('   - access_token type:', typeof session.access_token);
  console.log('   - access_token preview:', session.access_token?.substring(0, 30) + '...');
  console.log('   - Has user:', !!session.user);
  console.log('   - User ID:', session.user?.id);
  console.log('   - Email:', session.user?.email);

  // Test 3: Simulate what our code does
  console.log('\n3️⃣ Simulating code logic...');

  if (!session?.access_token) {
    console.log('❌ session.access_token is falsy');
    console.log('   This is why "No active session" appears');
  } else {
    console.log('✅ session.access_token is truthy');
    console.log('   The code SHOULD work!');
  }

  // Test 4: Check if it's a string issue
  console.log('\n4️⃣ Checking if session is stringified...');
  if (typeof session === 'string') {
    console.log('⚠️  Session is stored as a STRING, not an object!');
    console.log('   Attempting to parse...');
    try {
      const parsed = JSON.parse(session);
      console.log('✅ Successfully parsed');
      console.log('   - Has access_token:', !!parsed.access_token);
      console.log('   - User ID:', parsed.user?.id);
    } catch (e) {
      console.log('❌ Failed to parse:', e.message);
    }
  } else {
    console.log('✅ Session is already an object');
  }

  console.log('\n=== Test Complete ===');
})();
