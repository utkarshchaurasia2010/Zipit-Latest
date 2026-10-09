// High-performance image preloader and persistent browser cache manager for Zipit
const CACHE_NAME = 'zipit-images-v1';

// In-memory set of loaded image URLs to prevent duplicate fetches in current session
const memoryLoaded = new Set();

/**
 * Preload an array of image URLs into browser HTTP cache and CacheStorage
 * @param {string[]} urls
 */
export const preloadImages = async (urls) => {
  if (!urls || !Array.isArray(urls)) return;
  const validUrls = [...new Set(urls.filter(u => u && typeof u === 'string' && u.startsWith('http') && !u.includes('none.com')))];

  // Try modern CacheStorage API first for 100% offline & zero-latency persistence
  let cache = null;
  if ('caches' in window) {
    try {
      cache = await caches.open(CACHE_NAME);
    } catch (_) {}
  }

  validUrls.forEach(url => {
    if (memoryLoaded.has(url)) return;
    memoryLoaded.add(url);

    // 1. In-browser Image object prefetch (populates browser memory cache)
    const img = new Image();
    img.decoding = 'async';
    img.src = url;

    // 2. CacheStorage prefetch if not already stored
    if (cache) {
      cache.match(url).then(cachedResp => {
        if (!cachedResp) {
          fetch(url, { mode: 'cors', credentials: 'omit' })
            .then(resp => {
              if (resp.ok) {
                cache.put(url, resp);
              }
            })
            .catch(() => {});
        }
      }).catch(() => {});
    }
  });
};

/**
 * Automatically gathers all category, product, and banner image URLs and preloads them
 * @param {Array} products
 * @param {Array} categories
 * @param {Array} banners
 */
export const preloadCatalogImages = (products = [], categories = [], banners = []) => {
  try {
    const urls = [
      ...categories.map(c => c?.image_url),
      ...products.map(p => p?.image_url),
      ...banners.map(b => b?.image_url)
    ].filter(Boolean);

    preloadImages(urls);
  } catch (err) {
    console.warn('Preload catalog error:', err);
  }
};
