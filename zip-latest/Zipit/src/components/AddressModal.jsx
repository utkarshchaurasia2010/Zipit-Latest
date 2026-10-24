import React, { useState } from 'react';
import { X, MapPin, Search, Navigation, Plus } from 'lucide-react';
import { stripAddressTags } from './SavedAddressesPage';
import './AddressModal.css';

const AddressModal = ({ isOpen, onClose, addresses, navigate, onSelectAddress, currentRoute }) => {
  if (!isOpen) return null;

  const sortedAddresses = [...addresses].sort((a, b) => {
    if (a.is_default) return -1;
    if (b.is_default) return 1;
    return 0;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="address-modal-content slide-up" onClick={e => e.stopPropagation()}>
        <div className="modal-header-picker">
          <div style={{flex: 1}}>
            <h3 style={{fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-text)'}}>Select delivery location</h3>
          </div>
          <button className="close-btn-picker" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="address-list-scroll">
          <div className="picker-search-bar">
            <Search size={18} color="var(--color-text-light)" />
            <input type="text" placeholder="Search for area, street name..." className="picker-search-input" />
          </div>

          <div className="action-list picker-action-list">
            <div className="action-item" onClick={() => { onClose(); navigate('/saved-addresses', { state: { from: currentRoute || 'home', add: true } }); }}>
              <Plus size={20} color="#0c831f" />
              <span style={{color: '#0c831f', fontWeight: 600}}>Add new address</span>
            </div>
          </div>

          <h4 className="section-title">Your saved addresses</h4>

          {sortedAddresses.map(addr => (
            <div key={addr.id} className="address-card" style={{marginTop: 12}}>
              <div className="address-card-content">
                <div className="address-icon-box" onClick={() => { onSelectAddress && onSelectAddress(addr.id); onClose(); }}>
                  <div className={`icon-circle ${addr.is_default ? 'default-active' : ''}`}>
                    <MapPin size={20} color={addr.is_default ? "#FFF" : "#333"} />
                  </div>
                </div>
                <div className="address-info-box">
                  <div className="address-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <h4 style={{margin:0}} onClick={() => { onSelectAddress && onSelectAddress(addr.id); onClose(); }}>{addr.type}</h4>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        navigate('/saved-addresses', { state: { from: currentRoute || 'home', editId: addr.id } });
                      }}
                      style={{
                        background: 'rgba(12, 131, 31, 0.1)',
                        border: 'none',
                        color: '#0c831f',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: '4px 10px',
                        borderRadius: '6px'
                      }}
                    >
                      Edit
                    </button>
                  </div>
                  <p className="address-details" style={{margin: '4px 0', cursor: 'pointer'}} onClick={() => { onSelectAddress && onSelectAddress(addr.id); onClose(); }}>{stripAddressTags(addr.details)}</p>
                  {addr.landmark && (
                    <div style={{ fontSize: '11.5px', color: '#0c831f', fontWeight: 600, margin: '2px 0' }}>
                      🚩 Landmark: {addr.landmark}
                    </div>
                  )}
                  {addr.family_head && (
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text)', fontWeight: 500, margin: '2px 0' }}>
                      🏠 House: {addr.family_head}
                    </div>
                  )}
                  <p className="address-phone" style={{margin: 0}}>Phone number: <strong>{addr.phone || '9651568829'}</strong>{addr.alt_phone ? ` (Alt: ${addr.alt_phone})` : ''}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <a 
                      href={addr.google_maps_url || `https://maps.google.com/?q=${addr.lat || '28.4595'},${addr.lng || '77.0266'}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        fontSize: '11.5px', 
                        color: '#3B82F6', 
                        fontWeight: 600, 
                        textDecoration: 'none'
                      }}
                    >
                      <span>View on Google Maps</span>
                      <span style={{ fontSize: '13px', lineHeight: 1 }}>↗</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default AddressModal;
