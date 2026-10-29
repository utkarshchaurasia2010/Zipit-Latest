import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './HeroCarousel.css';

const HeroCarousel = ({ banners, onBannerClick }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragDelta, setDragDelta] = useState(0);
  const [slideRatios, setSlideRatios] = useState(() => {
    try {
      const cached = localStorage.getItem('zipit_cached_banner_ratios');
      return cached ? JSON.parse(cached) : {};
    } catch (_) {
      return {};
    }
  });
  const intervalRef = useRef(null);
  const count = banners.length;

  const updateRatio = useCallback((url, ratio) => {
    if (!url || !ratio || isNaN(ratio) || !isFinite(ratio) || ratio <= 0) return;
    setSlideRatios(prev => {
      if (prev[url] && Math.abs(prev[url] - ratio) < 0.005) return prev;
      const updated = { ...prev, [url]: ratio };
      try {
        localStorage.setItem('zipit_cached_banner_ratios', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  // Pre-measure images to determine their natural aspect ratio immediately
  useEffect(() => {
    if (!banners || banners.length === 0) return;
    banners.forEach((banner) => {
      const url = banner.image_url;
      if (url && url !== 'https://none.com/none.png' && url !== 'NONE' && !slideRatios[url]) {
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth && img.naturalHeight) {
            updateRatio(url, img.naturalWidth / img.naturalHeight);
          }
        };
        img.src = url;
        if (img.complete && img.naturalWidth && img.naturalHeight) {
          updateRatio(url, img.naturalWidth / img.naturalHeight);
        }
      }
    });
  }, [banners, slideRatios, updateRatio]);

  const goTo = useCallback((idx) => {
    // Infinite loop: wrap around
    setCurrentIdx(((idx % count) + count) % count);
  }, [count]);

  const startAutoPlay = useCallback(() => {
    clearInterval(intervalRef.current);
    if (count > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIdx(prev => (prev + 1) % count);
      }, 4000);
    }
  }, [count]);

  useEffect(() => {
    startAutoPlay();
    return () => clearInterval(intervalRef.current);
  }, [startAutoPlay]);

  const handlePrev = () => {
    goTo(currentIdx - 1);
    startAutoPlay();
  };

  const handleNext = () => {
    goTo(currentIdx + 1);
    startAutoPlay();
  };

  // Touch / mouse drag support
  const handleDragStart = (clientX) => {
    setIsDragging(true);
    setDragStartX(clientX);
    setDragDelta(0);
    clearInterval(intervalRef.current);
  };

  const handleDragMove = (clientX) => {
    if (!isDragging) return;
    let delta = clientX - dragStartX;
    // Elastic resistance if dragging at boundary
    if ((currentIdx === 0 && delta > 0) || (currentIdx === count - 1 && delta < 0)) {
      delta = delta * 0.25;
    }
    setDragDelta(delta);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragDelta < -45) handleNext();
    else if (dragDelta > 45) handlePrev();
    else startAutoPlay();
    setDragDelta(0);
  };

  if (!banners || count === 0) return null;

  const activeBanner = banners[currentIdx] || banners[0];
  const activeImageUrl = activeBanner?.image_url;
  const activeRatio = (activeImageUrl && slideRatios[activeImageUrl]) 
    || Object.values(slideRatios)[0] 
    || null;

  return (
    <div 
      className="hero-carousel-wrapper"
      style={{
        aspectRatio: activeRatio ? `${activeRatio}` : '16 / 9',
        backgroundColor: activeBanner?.bg_color || 'transparent'
      }}
    >
      <div 
        className="hero-carousel-track-outer"
        onMouseDown={(e) => handleDragStart(e.clientX)}
        onMouseMove={(e) => handleDragMove(e.clientX)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
        onTouchEnd={handleDragEnd}
      >
        <div
          className="hero-carousel-track"
          style={{
            transform: `translateX(calc(-${currentIdx * 100}% + ${dragDelta}px))`,
            transition: isDragging ? 'none' : 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        >
          {banners.map((banner, i) => {
            const hasImage = banner.image_url && banner.image_url !== 'https://none.com/none.png' && banner.image_url !== 'NONE';
            return (
              <div
                key={banner.id}
                className="hero-carousel-slide"
                onClick={() => onBannerClick && onBannerClick(banner)}
                style={{ 
                  cursor: banner.link_url ? 'pointer' : 'default',
                  backgroundColor: banner.bg_color || 'transparent'
                }}
              >
                {hasImage ? (
                  <img
                    src={banner.image_url}
                    alt={`Quickly Offer Banner ${i + 1}`}
                    className="hero-carousel-img"
                    draggable={false}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "low"}
                    decoding="async"
                    onLoad={(e) => {
                      if (e.target.naturalWidth && e.target.naturalHeight) {
                        updateRatio(banner.image_url, e.target.naturalWidth / e.target.naturalHeight);
                      }
                    }}
                  />
                ) : (
                  <div
                    className="hero-carousel-color-slide"
                    style={{ background: banner.bg_color || '#F8CB46' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Left / Right arrows — only show when more than 1 banner */}
      {count > 1 && (
        <>
          <button className="hero-carousel-arrow hero-carousel-arrow-left" onClick={handlePrev} aria-label="Previous banner">
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <button className="hero-carousel-arrow hero-carousel-arrow-right" onClick={handleNext} aria-label="Next banner">
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </>
      )}

      {/* Pagination dots */}
      {count > 1 && (
        <div className="hero-carousel-dots">
          {banners.map((_, i) => (
            <button
              key={i}
              className={`hero-carousel-dot ${i === currentIdx ? 'active' : ''}`}
              onClick={() => { goTo(i); startAutoPlay(); }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HeroCarousel;
