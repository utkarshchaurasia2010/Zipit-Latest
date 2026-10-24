import React, { useState, useEffect, useRef } from 'react';

/**
 * LazySection
 * Defers rendering of offscreen page components or sections until the user scrolls
 * near them (rootMargin: 250px).
 * Prevents mounting expensive DOM nodes, images, and triggering component network/effect payloads
 * until actually needed by the user.
 */
const LazySection = ({ children, minHeight = 240, placeholder = null, rootMargin = '250px' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isVisible) return;

    // Fallback if IntersectionObserver is not supported
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [isVisible, rootMargin]);

  if (isVisible) {
    return <>{children}</>;
  }

  return (
    <div 
      ref={containerRef} 
      style={{ 
        minHeight: `${minHeight}px`, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        contain: 'paint layout'
      }}
    >
      {placeholder || (
        <div style={{
          width: '100%',
          height: `${minHeight}px`,
          borderRadius: '16px',
          background: 'var(--color-surface-muted, rgba(0,0,0,0.03))',
          animation: 'pulse 1.8s infinite'
        }} />
      )}
    </div>
  );
};

export default LazySection;
