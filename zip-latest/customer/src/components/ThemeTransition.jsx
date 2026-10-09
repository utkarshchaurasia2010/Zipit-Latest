import React from 'react';
import { Moon, Sun } from 'lucide-react';
import './ThemeTransition.css';

const ThemeTransition = ({ active, theme }) => {
  if (!active) return null;

  return (
    <div className={`theme-transition-overlay ${active ? 'active' : ''} ${theme}`}>
      <div className="theme-transition-circle">
        {theme === 'dark' ? (
          <Moon size={80} color="#FFF" className="theme-icon" />
        ) : (
          <Sun size={80} color="#F59E0B" className="theme-icon" />
        )}
      </div>
    </div>
  );
};

export default ThemeTransition;
