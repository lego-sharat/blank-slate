// This script handles the OAuth callback from Supabase
// We need to store the entire callback URL so the main app can let Supabase parse it
(async () => {
  try {
    console.log('=== Auth Callback Page Loaded ===');

    // Get the full URL with hash fragment
    const callbackUrl = window.location.href;
    const hash = window.location.hash;

    if (!hash) {
      throw new Error('No authentication data received');
    }

    console.log('Callback URL received with hash fragment');

    // Parse the hash to verify we have tokens
    const params = new URLSearchParams(hash.substring(1));
    const hasAccessToken = !!params.get('access_token');
    const hasProviderToken = !!params.get('provider_token');

    console.log('Tokens present:', {
      access_token: hasAccessToken,
      provider_token: hasProviderToken,
      refresh_token: !!params.get('refresh_token'),
      provider_refresh_token: !!params.get('provider_refresh_token')
    });

    if (!hasAccessToken) {
      throw new Error('No access token in callback URL');
    }

    // Store the callback URL with hash so main app can process it with Supabase
    await chrome.storage.local.set({
      supabase_auth_callback: {
        callback_url: callbackUrl,
        hash: hash,
        timestamp: Date.now()
      }
    });

    console.log('Callback URL stored successfully');

    // Notify the extension that auth callback is ready
    chrome.runtime.sendMessage({ type: 'AUTH_CALLBACK_COMPLETE' }, (response) => {
      console.log('Notified main extension, response:', response);
      // Close this window after a short delay
      setTimeout(() => {
        console.log('Closing callback window...');
        window.close();
      }, 500);
    });

  } catch (error) {
    console.error('Auth callback error:', error);
    document.querySelector('.message').innerHTML = `
      <p style="color: red;">Authentication failed</p>
      <p style="font-size: 14px;">${error.message}</p>
      <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">Close</button>
    `;
  }
})();
