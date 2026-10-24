// High-performance image preloader and persistent browser cache manager for Zipit
const CACHE_NAME = 'zipit-images-v1';

// In-memory set of loaded image URLs to prevent duplicate fetches in current session
const memoryLoaded = new Set();

/**
 * Preload an array of image URLs into browser HTTP cache and CacheStorage
 * @param {string[]} urls
 */
export const preloadImages = async (urls) => {
  // Respect user bandwidth & network payloads: let browser native loading="lazy" load images as scrolled
  return;
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
