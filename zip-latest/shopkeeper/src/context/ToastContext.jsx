import React, { createContext, useContext, useState } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState({ visible: false, title: '', message: '' });

  const showToast = (message, title = 'Notification') => {
    setToast({ visible: true, title, message });
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast 
        visible={toast.visible} 
        title={toast.title} 
        message={toast.message} 
        onClose={() => setToast({ ...toast, visible: false })} 
      />
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
