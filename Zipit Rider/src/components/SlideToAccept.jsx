import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import './SlideToAccept.css';

export default function SlideToAccept({ onAccept, label = "Slide to Accept", disabled = false, resetTrigger = null }) {
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const sliderPosRef = useRef(0);
  const isCompletedRef = useRef(false);

  useEffect(() => {
    isCompletedRef.current = isCompleted;
  }, [isCompleted]);

  useEffect(() => {
    if (resetTrigger !== null && resetTrigger !== undefined) {
      setIsCompleted(false);
      isCompletedRef.current = false;
      setSliderPosition(0);
      sliderPosRef.current = 0;
      setIsDragging(false);
      isDraggingRef.current = false;
    }
  }, [resetTrigger]);

  const getMaxTravel = useCallback(() => {
    if (!containerRef.current) return 220;
    const containerW = containerRef.current.clientWidth || 280;
    const handleW = 48;
    return Math.max(80, containerW - handleW - 8);
  }, []);

  const handleStart = (clientX) => {
    if (disabled || isCompletedRef.current) return;
    setIsDragging(true);
    isDraggingRef.current = true;
  };

  const handleMove = useCallback((clientX) => {
    if (!isDraggingRef.current || disabled || isCompletedRef.current || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const maxTravel = getMaxTravel();
    let currentX = clientX - containerRect.left - 24; // center 48px handle

    if (currentX < 0) currentX = 0;
    if (currentX > maxTravel) currentX = maxTravel;

    sliderPosRef.current = currentX;
    setSliderPosition(currentX);

    // Threshold for acceptance: 75% crossed allows effortless confirmation
    if (currentX >= maxTravel * 0.75) {
      isDraggingRef.current = false;
      setIsDragging(false);
      sliderPosRef.current = maxTravel;
      setSliderPosition(maxTravel);
      setIsCompleted(true);
      isCompletedRef.current = true;
      if (onAccept) onAccept();
    }
  }, [disabled, getMaxTravel, onAccept]);

  const handleEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    
    const maxTravel = getMaxTravel();
    if (sliderPosRef.current < maxTravel * 0.75) {
      sliderPosRef.current = 0;
      setSliderPosition(0); // smooth bounce back
    }
  }, [getMaxTravel]);

  // Global listeners for both mouse and touch
  useEffect(() => {
    const onWindowMouseMove = (e) => {
      if (isDraggingRef.current) handleMove(e.clientX);
    };
    const onWindowMouseUp = () => {
      if (isDraggingRef.current) handleEnd();
    };

    const onWindowTouchMove = (e) => {
      if (isDraggingRef.current && e.touches && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };
    const onWindowTouchEnd = () => {
      if (isDraggingRef.current) handleEnd();
    };

    window.addEventListener('mousemove', onWindowMouseMove, { passive: true });
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('touchmove', onWindowTouchMove, { passive: true });
    window.addEventListener('touchend', onWindowTouchEnd);
    window.addEventListener('touchcancel', onWindowTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
      window.removeEventListener('touchcancel', onWindowTouchEnd);
    };
  }, [handleMove, handleEnd]);

  const fillWidth = sliderPosition + 24;

  return (
    <div
      ref={containerRef}
      className={`slide-to-accept-container ${isCompleted ? 'completed' : ''} ${disabled ? 'disabled' : ''}`}
      onMouseDown={(e) => handleStart(e.clientX)}
      onTouchStart={(e) => {
        if (e.touches && e.touches[0]) handleStart(e.touches[0].clientX);
      }}
    >
      <div
        className="slide-fill"
        style={{ 
          width: isCompleted ? '100%' : `${fillWidth}px`,
          transition: isDragging ? 'none' : 'width 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)'
        }}
      />
      
      <span className="slide-text">
        {isCompleted ? 'CONFIRMED' : label}
      </span>

      <div
        className={`slide-handle ${isDragging ? 'dragging' : ''}`}
        style={{ 
          transform: `translateX(${sliderPosition}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1), box-shadow 0.2s'
        }}
      >
        {isCompleted ? <Check size={22} color="#fff" strokeWidth={3} /> : <ArrowRight size={22} color="#15803d" strokeWidth={2.5} />}
      </div>
    </div>
  );
}
