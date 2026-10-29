import React from 'react';
import './SkeletonLoader.css';

export const PageSkeleton = ({ type = 'list' }) => {
  if (type === 'orders') {
    return (
      <div className="skeleton-container" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div className="skeleton-box" style={{ width: '36px', height: '36px', borderRadius: '10px' }}></div>
          <div className="skeleton-box" style={{ width: '140px', height: '22px', borderRadius: '6px' }}></div>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '16px', marginBottom: '16px', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div className="skeleton-box" style={{ width: '100px', height: '24px', borderRadius: '20px' }}></div>
              <div className="skeleton-box" style={{ width: '70px', height: '14px', borderRadius: '4px' }}></div>
            </div>
            <div className="skeleton-box" style={{ width: '100%', height: '56px', borderRadius: '10px', marginBottom: '12px' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="skeleton-box" style={{ width: '80px', height: '18px', borderRadius: '4px' }}></div>
              <div className="skeleton-box" style={{ width: '90px', height: '32px', borderRadius: '8px' }}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'products') {
    return (
      <div className="skeleton-container" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div className="skeleton-box" style={{ width: '36px', height: '36px', borderRadius: '10px' }}></div>
          <div className="skeleton-box" style={{ width: '160px', height: '22px', borderRadius: '6px' }}></div>
        </div>
        <div className="skeleton-grid-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ background: 'var(--color-surface)', borderRadius: '14px', padding: '12px', border: '1px solid var(--color-border)' }}>
              <div className="skeleton-box" style={{ width: '100%', aspectRatio: '1', borderRadius: '10px', marginBottom: '10px' }}></div>
              <div className="skeleton-box" style={{ width: '85%', height: '14px', borderRadius: '4px', marginBottom: '6px' }}></div>
              <div className="skeleton-box" style={{ width: '50%', height: '12px', borderRadius: '4px', marginBottom: '10px' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton-box" style={{ width: '45px', height: '18px', borderRadius: '4px' }}></div>
                <div className="skeleton-box" style={{ width: '60px', height: '28px', borderRadius: '8px' }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'track') {
    return (
      <div className="skeleton-container" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div className="skeleton-box" style={{ width: '36px', height: '36px', borderRadius: '10px' }}></div>
          <div className="skeleton-box" style={{ width: '140px', height: '22px', borderRadius: '6px' }}></div>
        </div>
        <div className="skeleton-box" style={{ width: '100%', height: '260px', borderRadius: '20px', marginBottom: '16px' }}></div>
        <div style={{ background: 'var(--color-surface)', borderRadius: '18px', padding: '18px', border: '1px solid var(--color-border)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div className="skeleton-box" style={{ width: '120px', height: '18px', borderRadius: '6px' }}></div>
            <div className="skeleton-box" style={{ width: '80px', height: '18px', borderRadius: '6px' }}></div>
          </div>
          <div className="skeleton-box" style={{ width: '100%', height: '12px', borderRadius: '6px', marginBottom: '20px' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="skeleton-box" style={{ width: '48px', height: '48px', borderRadius: '50%' }}></div>
            <div style={{ flex: 1 }}>
              <div className="skeleton-box" style={{ width: '110px', height: '14px', borderRadius: '4px', marginBottom: '6px' }}></div>
              <div className="skeleton-box" style={{ width: '70px', height: '12px', borderRadius: '4px' }}></div>
            </div>
            <div className="skeleton-box" style={{ width: '70px', height: '36px', borderRadius: '12px' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="skeleton-container" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div className="skeleton-box" style={{ width: '36px', height: '36px', borderRadius: '10px' }}></div>
        <div className="skeleton-box" style={{ width: '150px', height: '20px', borderRadius: '4px' }}></div>
      </div>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton-box" style={{ width: '100%', height: '64px', borderRadius: '14px', marginBottom: '12px' }}></div>
      ))}
    </div>
  );
};

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
