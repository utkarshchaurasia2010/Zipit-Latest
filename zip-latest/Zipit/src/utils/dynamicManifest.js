/**
 * Dynamically updates the PWA web manifest, apple-touch-icon, and browser favicon
 * to allow home screen launcher icons to update without reinstalling.
 */

export const applyDynamicBrandingIcons = (logoUrl, appName = 'Zipit') => {
  if (!logoUrl) return;

  try {
    // 1. Update Favicon
    let favicon = document.querySelector("link[rel*='icon']");
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.type = 'image/png';
      document.head.appendChild(favicon);
    }
    favicon.href = logoUrl;

    // 2. Update Apple Touch Icon (iOS home screen launcher)
    let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = logoUrl;

    // 3. Generate dynamic Web App Manifest
    const dynamicManifest = {
      name: `${appName} - India's Rural Delivery App`,
      short_name: appName,
      description: 'Instant delivery app for rural and semi-urban India',
      start_url: '/',
      theme_color: '#0a0a0c',
      background_color: '#0a0a0c',
      display: 'standalone',
      orientation: 'portrait',
      icons: [
        {
          src: logoUrl,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: logoUrl,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    };

    const manifestBlob = new Blob([JSON.stringify(dynamicManifest)], { type: 'application/manifest+json' });
    const manifestBlobUrl = URL.createObjectURL(manifestBlob);

    // Swap out existing manifest link with new Blob URL
    let manifestLink = document.querySelector("link[rel='manifest']");
    if (manifestLink) {
      manifestLink.href = manifestBlobUrl;
    } else {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = manifestBlobUrl;
      document.head.appendChild(manifestLink);
    }

    // Cache logo locally for immediate 0ms paint on subsequent runs
    localStorage.setItem('zipit_cached_customer_logo', logoUrl);
  } catch (err) {
    console.warn('Failed to apply dynamic branding icons:', err);
  }
};
