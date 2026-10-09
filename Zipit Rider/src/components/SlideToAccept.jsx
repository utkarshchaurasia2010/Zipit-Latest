import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import './SlideToAccept.css';

export default function SlideToAccept({ onAccept, label = "Slide to Accept", disabled = false, resetTrigger = null }) {
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const containerRef = useRef(null);
  const handleRef = useRef(null);

  useEffect(() => {
    if (resetTrigger !== null && resetTrigger !== undefined) {
      setIsCompleted(false);
      setSliderPosition(0);
      setIsDragging(false);
    }
  }, [resetTrigger]);

  const getContainerWidth = () => {
    if (!containerRef.current) return 280;
    return containerRef.current.clientWidth;
  };

  const getMaxTravel = () => {
    const containerW = getContainerWidth();
    const handleW = 54;
    return containerW - handleW - 8; // padding offset
  };

  const handleStart = (clientX) => {
    if (disabled || isCompleted) return;
    setIsDragging(true);
  };

  const handleMove = (clientX) => {
    if (!isDragging || disabled || isCompleted) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const maxTravel = getMaxTravel();
    let currentX = clientX - containerRect.left - 27; // center handle

    if (currentX < 0) currentX = 0;
    if (currentX > maxTravel) currentX = maxTravel;

    setSliderPosition(currentX);

    // Threshold for acceptance (90% crossed)
    if (currentX >= maxTravel * 0.88) {
      setIsDragging(false);
      setSliderPosition(maxTravel);
      setIsCompleted(true);
      if (onAccept) onAccept();
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const maxTravel = getMaxTravel();
    if (sliderPosition < maxTravel * 0.88) {
      setSliderPosition(0); // bounce back
    }
  };

  // Mouse event listeners
  const onMouseDown = (e) => handleStart(e.clientX);
  const onMouseMove = (e) => handleMove(e.clientX);
  const onMouseUp = () => handleEnd();

  // Touch event listeners
  const onTouchStart = (e) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e) => handleMove(e.touches[0].clientX);
  const onTouchEnd = () => handleEnd();

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDragging) handleMove(e.clientX);
    };
    const handleGlobalMouseUp = () => {
      if (isDragging) handleEnd();
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, sliderPosition]);

  const maxTravel = getMaxTravel();
  const fillWidth = sliderPosition + 27;

  return (
    <div
      ref={containerRef}
      className={`slide-to-accept-container ${isCompleted ? 'completed' : ''} ${disabled ? 'disabled' : ''}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="slide-fill"
        style={{ width: isCompleted ? '100%' : `${fillWidth}px` }}
      />
      
      <span className="slide-text">
        {isCompleted ? 'CONFIRMED' : label}
      </span>

      <div
        ref={handleRef}
        className={`slide-handle ${isDragging ? 'dragging' : ''}`}
        style={{ transform: `translateX(${sliderPosition}px)` }}
        onMouseDown={onMouseDown}
      >
        {isCompleted ? <Check size={22} color="#fff" /> : <ArrowRight size={22} color="#15803d" />}
      </div>
    </div>
  );
}
