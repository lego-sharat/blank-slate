// This script handles the OAuth callback from Supabase
(async () => {
  try {
    console.log('Auth callback page loaded');

    // Get the hash fragment from the URL
    const hash = window.location.hash.substring(1);

    if (!hash) {
      throw new Error('No authentication data received');
    }

    console.log('Hash fragment received, parsing tokens...');

    // Parse the hash parameters
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = params.get('expires_in');
    const providerToken = params.get('provider_token');
    const providerRefreshToken = params.get('provider_refresh_token');

    if (!accessToken) {
      throw new Error('No access token received');
    }

    console.log('OAuth callback received:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      hasProviderToken: !!providerToken,
      hasProviderRefreshToken: !!providerRefreshToken,
      expiresIn,
      accessTokenLength: accessToken?.length,
      providerTokenLength: providerToken?.length
    });

    // Store the tokens temporarily so the main app can pick them up
    await chrome.storage.local.set({
      supabase_auth_callback: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: parseInt(expiresIn) || 3600,
        provider_token: providerToken,
        provider_refresh_token: providerRefreshToken,
        timestamp: Date.now()
      }
    });

    console.log('Tokens stored in chrome.storage.local');

    // Notify the extension that auth completed
    chrome.runtime.sendMessage({ type: 'AUTH_CALLBACK_COMPLETE' }, (response) => {
      console.log('Message sent to extension, response:', response);
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
