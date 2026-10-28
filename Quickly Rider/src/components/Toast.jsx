import React, { useEffect } from 'react';
import './Toast.css';
import { Bell } from 'lucide-react';

const Toast = ({ message, title, onClose, visible }) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  const getIconBg = () => {
    if (title?.toLowerCase() === 'error') return '#dc2626';
    if (title?.toLowerCase() === 'warning') return '#d97706';
    return '#10b981';
  };

  const formattedTitle = title ? title.charAt(0).toUpperCase() + title.slice(1) : 'Notification';

  return (
    <div className="toast-container fade-in-up" onClick={onClose}>
      <div className="toast-icon" style={{ background: getIconBg() }}>
        <Bell size={18} color="#FFF" />
      </div>
      <div className="toast-content">
        <h4>{formattedTitle}</h4>
        <p>{message}</p>
      </div>
    </div>
  );
};

export default Toast;
