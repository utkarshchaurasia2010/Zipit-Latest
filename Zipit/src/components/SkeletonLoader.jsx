import React from 'react';
import './SkeletonLoader.css';

const SkeletonLoader = () => {
  return (
    <div className="skeleton-container">
      {/* Header Skeleton */}
      <div className="skeleton-header">
        <div className="skeleton-location">
          <div className="skeleton-box" style={{ width: '40px', height: '40px', borderRadius: '50%' }}></div>
          <div style={{ flex: 1, marginLeft: '12px' }}>
            <div className="skeleton-box" style={{ width: '120px', height: '16px', borderRadius: '4px', marginBottom: '8px' }}></div>
            <div className="skeleton-box" style={{ width: '180px', height: '12px', borderRadius: '4px' }}></div>
          </div>
          <div className="skeleton-box" style={{ width: '36px', height: '36px', borderRadius: '50%' }}></div>
        </div>
        <div className="skeleton-search">
          <div className="skeleton-box" style={{ width: '100%', height: '48px', borderRadius: '12px', marginTop: '16px' }}></div>
        </div>
      </div>

      {/* Hero Skeleton */}
      <div className="skeleton-hero">
        <div className="skeleton-box" style={{ width: '100%', height: '180px', borderRadius: '16px' }}></div>
      </div>

      {/* Categories Skeleton */}
      <div className="skeleton-section">
        <div className="skeleton-box" style={{ width: '140px', height: '20px', borderRadius: '4px', marginBottom: '16px' }}></div>
        <div className="skeleton-grid-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div className="skeleton-box" style={{ width: '100%', aspectRatio: '1', borderRadius: '12px' }}></div>
              <div className="skeleton-box" style={{ width: '80%', height: '10px', borderRadius: '4px' }}></div>
            </div>
          ))}
        </div>
      </div>

      {/* Products Skeleton */}
      <div className="skeleton-section">
        <div className="skeleton-box" style={{ width: '160px', height: '20px', borderRadius: '4px', marginBottom: '16px' }}></div>
        <div className="skeleton-grid-2">
          {[1,2,3,4].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="skeleton-box" style={{ width: '100%', aspectRatio: '1', borderRadius: '8px', marginBottom: '12px' }}></div>
              <div className="skeleton-box" style={{ width: '90%', height: '12px', borderRadius: '4px', marginBottom: '8px' }}></div>
              <div className="skeleton-box" style={{ width: '60%', height: '10px', borderRadius: '4px', marginBottom: '12px' }}></div>
              <div className="skeleton-box" style={{ width: '40%', height: '16px', borderRadius: '4px' }}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonLoader;
