import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './HeroCarousel.css';

const HeroCarousel = ({ banners, onBannerClick }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragDelta, setDragDelta] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const intervalRef = useRef(null);
  const count = banners.length;

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

  useEffect(() => {
    const handleScroll = () => {
      // Find the scrollable container. If body/window scrolls:
      setScrollY(document.querySelector('.page-transition > div')?.scrollTop || window.scrollY);
    };
    const scrollContainer = document.querySelector('.page-transition > div') || window;
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

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
    setDragDelta(clientX - dragStartX);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragDelta < -50) handleNext();
    else if (dragDelta > 50) handlePrev();
    else startAutoPlay();
    setDragDelta(0);
  };

  if (!banners || count === 0) return null;

  // We create a parallax effect based on scrollY
  const parallaxTransform = `translateY(${scrollY * 0.4}px) scale(${Math.max(0.9, 1 - scrollY * 0.0005)})`;
  const parallaxOpacity = Math.max(0, 1 - scrollY * 0.003);

  return (
    <div 
      className="hero-carousel-wrapper"
      style={{
        transform: parallaxTransform,
        opacity: parallaxOpacity,
        transformOrigin: 'bottom center'
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
            transition: isDragging ? 'none' : 'transform 0.55s cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        >
          {banners.map((banner, i) => {
            const hasImage = banner.image_url && banner.image_url !== 'https://none.com/none.png' && banner.image_url !== 'NONE';
            return (
              <div
                key={banner.id}
                className="hero-carousel-slide"
                onClick={() => onBannerClick && onBannerClick(banner)}
                style={{ cursor: banner.link_url ? 'pointer' : 'default' }}
              >
                {hasImage ? (
                  <img
                    src={banner.image_url}
                    alt={`Banner ${i + 1}`}
                    className="hero-carousel-img"
                    draggable={false}
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
