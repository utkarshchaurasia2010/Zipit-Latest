import React, { useEffect, useState } from 'react';
import './Toast.css';
import { Bell } from 'lucide-react';

const Toast = ({ message, title, onClose, visible }) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsClosing(false);
      const timer = setTimeout(() => {
        handleClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 400); // Wait for animation to finish
  };

  if (!visible && !isClosing) return null;

  return (
    <div className={`toast-container ${isClosing ? 'slide-out-up' : 'fade-in-down'}`} onClick={handleClose}>
      <div className="toast-icon">
        <Bell size={20} color="#FFF" />
      </div>
      <div className="toast-content">
        <h4>{title}</h4>
        <p>{message}</p>
      </div>
    </div>
  );
};

export default Toast;
