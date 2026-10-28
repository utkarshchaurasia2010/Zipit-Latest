import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowDown, Check } from 'lucide-react';
import './PullToRefresh.css';

const THRESHOLD = 75; // Pixels needed to trigger refresh
const MAX_PULL = 130; // Max resistance pull distance

const PullToRefresh = ({ onRefresh, children }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [status, setStatus] = useState('idle'); // 'idle' | 'pulling' | 'ready' | 'refreshing' | 'success'
  const [isDragging, setIsDragging] = useState(false);

  const startY = useRef(0);
  const currentY = useRef(0);
  const isAtTop = useRef(true);
  const containerRef = useRef(null);

  const calculateResistance = (distance) => {
    if (distance <= 0) return 0;
    // Damped elastic resistance formula
    return Math.min(MAX_PULL, Math.pow(distance, 0.85) * 0.7);
  };

  const getScrollTop = () => {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  };

  const handleStart = (y) => {
    if (status === 'refreshing' || status === 'success') return;
    // Allow starting pull-to-refresh if at top of page OR if dragging from top header bar (y <= 110)
    isAtTop.current = getScrollTop() <= 20 || y <= 110;
    if (isAtTop.current) {
      startY.current = y;
      currentY.current = y;
      setIsDragging(true);
    }
  };

  const handleMove = (y) => {
    if (!isDragging || status === 'refreshing' || status === 'success') return;
    currentY.current = y;
    const rawDiff = currentY.current - startY.current;

    const currentScroll = getScrollTop();
    // Enable pull if at top of page or if dragging started from top header area
    const canPull = currentScroll <= 20 || isAtTop.current;

    if (rawDiff > 5 && canPull) {
      const damped = calculateResistance(rawDiff);
      setPullDistance(damped);
      setStatus(damped >= THRESHOLD ? 'ready' : 'pulling');
    } else if (rawDiff <= 0) {
      setPullDistance(0);
      setStatus('idle');
    }
  };

  const triggerRefresh = useCallback(async () => {
    setStatus('refreshing');
    setPullDistance(THRESHOLD);
    
    try {
      if (onRefresh) {
        // Enforce a minimum display time of 800ms so the loader animation looks satisfying
        const minDelay = new Promise((resolve) => setTimeout(resolve, 800));
        await Promise.all([onRefresh(), minDelay]);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      
      setStatus('success');
      setTimeout(() => {
        setPullDistance(0);
        setStatus('idle');
      }, 650);
    } catch (e) {
      console.error("Refresh failed", e);
      setPullDistance(0);
      setStatus('idle');
    }
  }, [onRefresh]);

  const handleEnd = () => {
    if (!isDragging || status === 'refreshing' || status === 'success') return;
    setIsDragging(false);

    if (status === 'ready' && pullDistance >= THRESHOLD) {
      triggerRefresh();
    } else {
      setPullDistance(0);
      setStatus('idle');
    }
  };

  // Touch handlers
  const handleTouchStart = (e) => handleStart(e.touches[0].clientY);
  const handleTouchMove = (e) => handleMove(e.touches[0].clientY);
  const handleTouchEnd = () => handleEnd();

  // Mouse handlers for desktop testing
  const handleMouseDown = (e) => {
    if (e.button === 0) {
      const topScroll = getScrollTop() <= 20;
      const topArea = e.clientY <= 110;
      if (topScroll || topArea) {
        handleStart(e.clientY);
      }
    }
  };
  const handleMouseMove = (e) => {
    if (isDragging) {
      handleMove(e.clientY);
    }
  };
  const handleMouseUp = () => {
    if (isDragging) {
      handleEnd();
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, status, pullDistance]);

  // Calculate pill Y position based on pull distance
  // Starts at -80px (hidden) and slides down to +24px
  const pillY = status === 'idle' && pullDistance === 0 
    ? -80 
    : Math.min(32, -80 + pullDistance * 1.55);

  return (
    <div 
      ref={containerRef}
      className="pull-refresh-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      {/* Branded Glassmorphism Pull Indicator Pill */}
      <div 
        className={`pull-refresh-pill ${status} ${isDragging ? 'dragging' : ''}`}
        style={{ transform: `translateX(-50%) translateY(${pillY}px)` }}
      >
        <span className={`pull-refresh-icon ${status === 'refreshing' ? 'spin' : ''}`}>
          {status === 'success' ? (
            <Check size={16} strokeWidth={2.5} />
          ) : status === 'ready' ? (
            <ArrowDown size={16} strokeWidth={2.5} style={{ transform: 'rotate(180deg)' }} />
          ) : status === 'refreshing' ? (
            <RefreshCw size={16} strokeWidth={2.5} />
          ) : (
            <ArrowDown size={16} strokeWidth={2.5} />
          )}
        </span>
        <span className="pull-refresh-text">
          {status === 'success' && 'Updated! ✓'}
          {status === 'refreshing' && 'Refreshing...'}
          {status === 'ready' && 'Release to refresh...'}
          {status === 'pulling' && 'Pull to refresh...'}
        </span>
      </div>

      {children}
    </div>
  );
};

export default PullToRefresh;
