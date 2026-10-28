/**
 * Cloudflare Turnstile Invisible CAPTCHA Helper
 * 
 * Provides frictionless, zero-UI background bot verification.
 * Automatically loads Cloudflare Turnstile script on-demand and executes
 * verification tokens with timeout fallbacks so genuine users are never blocked.
 */

// Cloudflare official test key that always passes in development or when no custom key is provided:
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
// Key '1x00000000000000000000AA' always passes (ideal default until user configures their own key).
const DEFAULT_TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

let turnstileScriptLoading = null;

export const loadTurnstileScript = () => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptLoading) return turnstileScriptLoading;

  turnstileScriptLoading = new Promise((resolve) => {
    // Check if script tag already exists
    const existing = document.getElementById('cf-turnstile-script');
    if (existing) {
      const checkInterval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkInterval);
          resolve(window.turnstile);
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.id = 'cf-turnstile-script';
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const checkInterval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkInterval);
          resolve(window.turnstile);
        }
      }, 50);
    };
    script.onerror = () => {
      console.warn('Turnstile script failed to load. Proceeding in graceful fallback mode.');
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return turnstileScriptLoading;
};

/**
 * Execute an invisible Turnstile verification.
 * Returns a Promise that resolves with the verification token, or a fallback token on timeout.
 * 
 * @param {string} actionName e.g. 'login', 'send_otp', 'checkout'
 * @returns {Promise<string>} Turnstile token
 */
export const executeInvisibleTurnstile = async (actionName = 'submit') => {
  if (typeof window === 'undefined') return 'ssr-bypass';

  try {
    const turnstile = await loadTurnstileScript();
    if (!turnstile) {
      return 'fallback-token-no-script';
    }

    return await new Promise((resolve) => {
      // Create a temporary hidden container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '0';
      container.style.height = '0';
      container.style.overflow = 'hidden';
      container.style.visibility = 'hidden';
      document.body.appendChild(container);

      let widgetId = null;
      let isDone = false;

      // 4-second safety timeout so slow networks or ad-blockers never block legitimate customers
      const timeout = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          try {
            if (widgetId !== null && turnstile.remove) turnstile.remove(widgetId);
            container.remove();
          } catch (_) {}
          resolve('timeout-fallback-token');
        }
      }, 4000);

      try {
        widgetId = turnstile.render(container, {
          sitekey: DEFAULT_TURNSTILE_SITE_KEY,
          action: actionName,
          size: 'invisible',
          callback: (token) => {
            if (!isDone) {
              isDone = true;
              clearTimeout(timeout);
              try {
                if (widgetId !== null && turnstile.remove) turnstile.remove(widgetId);
                container.remove();
              } catch (_) {}
              resolve(token);
            }
          },
          'error-callback': (errCode) => {
            if (!isDone) {
              isDone = true;
              clearTimeout(timeout);
              console.warn('Turnstile challenge error:', errCode);
              try {
                if (widgetId !== null && turnstile.remove) turnstile.remove(widgetId);
                container.remove();
              } catch (_) {}
              // Gracefully resolve so genuine users are not stuck
              resolve('error-fallback-token');
            }
          }
        });
      } catch (renderErr) {
        clearTimeout(timeout);
        try { container.remove(); } catch (_) {}
        resolve('render-error-fallback');
      }
    });
  } catch (err) {
    console.warn('Turnstile execution exception:', err);
    return 'exception-fallback';
  }
};
