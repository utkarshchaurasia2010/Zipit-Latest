import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { useToast } from './ToastContext';

const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {
  const [wishlistIds, setWishlistIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  
  // Ref to hold the debounced save timer
  const saveTimerRef = useRef(null);

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        const ids = await db.wishlist.get();
        setWishlistIds(ids || []);
      } catch (error) {
        console.error('Failed to load wishlist:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchWishlist();
  }, []);

  // 1. MEMOIZATION: Wrap in useCallback to prevent unnecessary re-renders
  const toggleWishlist = useCallback((productId) => {
    setWishlistIds(prev => {
      const isRemoving = prev.includes(productId);
      const newIds = isRemoving 
        ? prev.filter(id => id !== productId) 
        : [...prev, productId];
      
      // 2. TOAST NOTIFICATION: Instant feedback
      if (isRemoving) {
        showToast('Removed from wishlist');
      } else {
        showToast('Added to wishlist', 'success');
      }
      
      // 3. DEBOUNCING: Wait 500ms before actually saving to database to prevent spam-clicking overhead
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      
      saveTimerRef.current = setTimeout(async () => {
        try {
          await db.wishlist.save(newIds);
        } catch (err) {
          console.error('Failed to save wishlist:', err);
          // Rollback could be implemented here by re-fetching if desired
          showToast('Failed to sync wishlist with database', 'error');
        }
      }, 500);

      return newIds;
    });
  }, [showToast]);

  // 1. MEMOIZATION: Wrap in useCallback
  const isInWishlist = useCallback((productId) => {
    return wishlistIds.includes(productId);
  }, [wishlistIds]);

  return (
    <WishlistContext.Provider value={{ wishlistIds, toggleWishlist, isInWishlist, loading }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => useContext(WishlistContext);
