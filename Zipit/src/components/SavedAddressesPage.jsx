import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Trash2, Edit2, MoreHorizontal, Share, Plus, X } from 'lucide-react';
import { db } from '../services/db';
import { useToast } from '../context/ToastContext';
import MapPinPicker from './MapPinPicker';
import './SavedAddressesPage.css';

export const stripAddressTags = (str) => {
  if (!str) return '';
  return str.toString().replace(/[\s\n]*---[A-Z_]+:[^-\n]*---/g, '').replace(/---.*$/, '').trim();
};

const SavedAddressesPage = ({ navigate, addresses, setAddresses, from, add }) => {
  const [isEditing, setIsEditing] = useState(null);
  const [formData, setFormData] = useState({
    type: 'Home',
    village_area: '',
    landmark: '',
    family_head: '',
    phone: '',
    alt_phone: '',
    details: ''
  });
  const [mapPinData, setMapPinData] = useState(null);
  const [step, setStep] = useState(1); // 1: Map Pin & GPS, 2: Village / House details
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(!!add);
  const { showToast } = useToast();

  useEffect(() => {
    if (isEditing || isAddingNew) {
      document.querySelector('.addresses-page')?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isEditing, isAddingNew]);

  const handleSave = async () => {
    // Generate combined details if not already present
    let combinedDetails = formData.details?.trim() || '';
    if (!combinedDetails) {
      const parts = [];
      if (formData.village_area?.trim()) parts.push(formData.village_area.trim());
      if (formData.landmark?.trim()) parts.push(`Landmark: ${formData.landmark.trim()}`);
      if (formData.family_head?.trim()) parts.push(`House: ${formData.family_head.trim()}`);
      combinedDetails = parts.join(', ');
    }

    if (!combinedDetails && !formData.landmark?.trim()) {
      showToast('Please enter your village name or landmark.', 'Address Required');
      return;
    }

    setLoading(true);
    try {
      const enrichedData = {
        ...formData,
        details: combinedDetails,
        gps_area: mapPinData?.areaTitle || localStorage.getItem('zipit_gps_area') || (formData.village_area || 'Village Delivery Zone'),
        lat: mapPinData?.lat || '28.4595',
        lng: mapPinData?.lng || '77.0266',
        map_full_address: mapPinData?.fullAddress || combinedDetails,
        google_maps_url: mapPinData?.googleMapsUrl || `https://maps.google.com/?q=${mapPinData?.lat || '28.4595'},${mapPinData?.lng || '77.0266'}`
      };
      if (isEditing) {
        await db.addresses.update(isEditing, enrichedData);
      } else {
        await db.addresses.add(enrichedData);
      }
      const refreshed = await db.addresses.getAll();
      setAddresses(refreshed);
      setIsEditing(null);
      setIsAddingNew(false);
      setFormData({
        type: 'Home',
        village_area: '',
        landmark: '',
        family_head: '',
        phone: '',
        alt_phone: '',
        details: ''
      });
      setMapPinData(null);
      setStep(1);
      showToast('Village Address & Landmark saved successfully!', 'Success');
    } catch (err) {
      showToast('Error saving address', 'Error');
      console.error(err);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    await db.addresses.delete(id);
    const refreshed = await db.addresses.getAll();
    setAddresses(refreshed);
    showToast('Address deleted', 'Success');
  };

  const handleSetDefault = async (id) => {
    await db.addresses.setDefault(id);
    const refreshed = await db.addresses.getAll();
    setAddresses(refreshed);
    showToast('Default address updated', 'Success');
  };

  const handleShare = (addr) => {
    const text = `${addr.type}\n${addr.details}`;
    if (navigator.share) {
      navigator.share({ title: 'My Address', text });
    } else {
      navigator.clipboard.writeText(text);
      showToast('Address copied to clipboard!', 'Copied');
    }
  };

  const sortedAddresses = [...addresses].sort((a, b) => {
    if (a.is_default) return -1;
    if (b.is_default) return 1;
    return 0;
  });

  return (
    <div className="addresses-page">
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', padding: '8px 16px' }}>
        <button 
          className="back-btn" 
          onClick={() => {
            if (isEditing || isAddingNew) {
              setIsEditing(null);
              setIsAddingNew(false);
              setStep(1);
            } else {
              navigate(from || 'profile');
            }
          }} 
          style={{ margin: 0, padding: '8px' }}
        >
          <ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} />
        </button>
        <h2 style={{ fontSize: '18px', margin: 0 }}>
          {isEditing ? 'Edit Address & Pin' : isAddingNew ? 'Add New Address & Pin' : 'My addresses'}
        </h2>
      </header>
      
      <div className="addresses-container">
        {loading && <div style={{textAlign:'center', fontSize: 12}}>Syncing...</div>}
        
        {!isAddingNew && !isEditing && (
          <div className="action-list">
            <div className="action-item" onClick={() => setIsAddingNew(true)}>
              <Plus size={20} color="#0c831f" strokeWidth={2.8} />
              <span style={{color: '#0c831f', fontWeight: 600}}>Add new address</span>
              <ChevronRight size={20} className="forward-arrow" color="var(--color-text-light)" strokeWidth={2.6} />
            </div>
          </div>
        )}

        {(!isAddingNew && !isEditing) && <h4 className="section-title">Your saved addresses</h4>}

        {(!isAddingNew && !isEditing) && sortedAddresses.map(addr => (
          <div 
            key={addr.id} 
            className={`address-card ${addr.is_default ? 'is-default-card' : ''}`}
            style={{ zIndex: showMenu === addr.id ? 100 : 1, position: 'relative' }}
          >
            <div className="address-card-content">
              <div className="address-icon-box" onClick={() => handleSetDefault(addr.id)}>
                <div className={`icon-circle ${addr.is_default ? 'default-active' : ''}`}>
                  <MapPin size={20} color={addr.is_default ? "#FFF" : "#333"} />
                </div>
              </div>
              <div className="address-info-box">
                <div className="address-header">
                  <h4 onClick={() => handleSetDefault(addr.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {addr.type}
                    {addr.is_default && <span style={{ background: 'rgba(12, 131, 31, 0.1)', color: '#0c831f', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>DEFAULT</span>}
                  </h4>
                  <MapPin size={16} className="pin-icon" />
                </div>
                <p className="address-details" onClick={() => handleSetDefault(addr.id)}>{stripAddressTags(addr.details)}</p>
                {addr.landmark && (
                  <div style={{ margin: '4px 0', fontSize: '12px', color: '#0c831f', fontWeight: 600 }}>
                    🚩 Landmark: {addr.landmark}
                  </div>
                )}
                {addr.family_head && (
                  <div style={{ margin: '2px 0', fontSize: '12px', color: 'var(--color-text)', fontWeight: 500 }}>
                    🏠 House: {addr.family_head}
                  </div>
                )}
                <p className="address-phone">
                  Phone: <strong>{addr.phone || '9651568829'}</strong>
                  {addr.alt_phone ? <span style={{ marginLeft: 8, color: 'var(--color-text-light)' }}>(Alt: {addr.alt_phone})</span> : null}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0 14px 0' }}>
                  <a 
                    href={addr.google_maps_url || `https://maps.google.com/?q=${addr.lat || '28.4595'},${addr.lng || '77.0266'}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      fontSize: '12px', 
                      color: '#3B82F6', 
                      fontWeight: 600, 
                      textDecoration: 'none'
                    }}
                  >
                    <span>View on Google Maps</span>
                    <span style={{ fontSize: '14px', lineHeight: 1 }}>↗</span>
                  </a>
                </div>
                
                <div className="address-actions-row" onClick={(e) => e.stopPropagation()}>
                  <div 
                    className="action-icon-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(showMenu === addr.id ? null : addr.id);
                    }}
                  >
                    <MoreHorizontal size={18} />
                  </div>
                  <div 
                    className="action-icon-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(addr);
                    }}
                  >
                    <Share size={18} />
                  </div>
                  
                  {showMenu === addr.id && (
                    <div className="address-menu-popup" onClick={(e) => e.stopPropagation()}>
                      {!addr.is_default && (
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefault(addr.id);
                            setShowMenu(null);
                          }}
                        >
                          <MapPin size={16} color="#0c831f" strokeWidth={2.5} />
                          <span style={{ color: '#0c831f' }}>Set as default</span>
                        </button>
                      )}
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEditing(addr.id);
                          setFormData({
                            type: addr.type || 'Home',
                            village_area: addr.village_area || '',
                            landmark: addr.landmark || '',
                            family_head: addr.family_head || '',
                            phone: addr.phone || '',
                            alt_phone: addr.alt_phone || '',
                            details: stripAddressTags(addr.details || '')
                          });
                          setStep(2);
                          setShowMenu(null);
                        }}
                      >
                        <Edit2 size={16} color="#3B82F6" strokeWidth={2.5} />
                        <span>Edit</span>
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(addr.id);
                          setShowMenu(null);
                        }} 
                        style={{ color: 'var(--color-danger)' }}
                      >
                        <Trash2 size={16} color="var(--color-danger)" strokeWidth={2.5} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {(isEditing || isAddingNew) && (
          <div className="new-address-form" style={{ textAlign: 'left', width: '100%' }}>
            {step === 1 ? (
              <div>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    style={{
                      width: '100%',
                      background: 'rgba(12, 131, 31, 0.1)',
                      border: '1.5px dashed #0c831f',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      color: '#0c831f',
                      fontWeight: 700,
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>🌾 Living in a village? Skip Map & Enter Landmark Directly ➔</span>
                  </button>
                </div>
                <MapPinPicker 
                  initialLat={mapPinData?.lat || 28.4595} 
                  initialLng={mapPinData?.lng || 77.0266} 
                  onConfirmLocation={(data) => {
                    setMapPinData(data);
                    if (!formData.village_area) {
                      setFormData(prev => ({ 
                        ...prev, 
                        village_area: data.areaTitle || '',
                        details: prev.details || data.fullAddress || ''
                      }));
                    }
                    setStep(2);
                  }}
                  onCancel={() => {
                    setIsEditing(null);
                    setIsAddingNew(false);
                  }}
                />
              </div>
            ) : (
              <div>
                <h3 style={{color: 'var(--color-text)', marginBottom: 16, textAlign: 'center'}}>
                  {isEditing ? 'Edit Address & Landmark' : 'Enter Address & Village Landmark'}
                </h3>

                {mapPinData && (
                  <div className="gps-map-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: 20, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '12px 14px', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: '#10B981', fontWeight: 700, fontSize: '13px' }}>
                        📍 Map Location: {mapPinData?.areaTitle || 'Selected Area'}
                      </span>
                      <span style={{ color: 'var(--color-text-light)', fontSize: '12px' }}>
                        {mapPinData?.fullAddress || 'Coordinates confirmed from map'}
                      </span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setStep(1)}
                      style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #10B981', background: 'transparent', color: '#10B981', fontWeight: 700, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Change Pin
                    </button>
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-light)', marginBottom: 6 }}>
                    Address Type
                  </label>
                  <select 
                    value={formData.type} 
                    disabled={!!isEditing}
                    onChange={e => setFormData({...formData, type: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px', 
                      borderRadius: '12px', 
                      border: '1px solid var(--color-border)', 
                      background: isEditing ? 'var(--color-surface)' : 'var(--color-surface-muted)', 
                      color: isEditing ? 'var(--color-text-light)' : 'var(--color-text)', 
                      outline: 'none', 
                      appearance: 'none',
                      cursor: isEditing ? 'not-allowed' : 'pointer',
                      opacity: isEditing ? 0.65 : 1
                    }}
                  >
                    <option value="Home">Home (घर)</option>
                    <option value="Shop">Shop / Business (दुकान)</option>
                    <option value="Other">Other (अन्य)</option>
                  </select>
                </div>

                {/* Village / Mohalla */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
                    Village / Mohalla / Area (गाँव / टोला / क्षेत्र) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Rampur Purab Tola, Ward No. 4..." 
                    value={formData.village_area || ''} 
                    onChange={e => setFormData({...formData, village_area: e.target.value})}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                  />
                </div>

                {/* Known Landmark (Most Critical for village) */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0c831f', marginBottom: 6 }}>
                    🚩 Known Landmark (पहचान / लैंडमार्क - सबसे ज़रूरी) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Purani Shiv Mandir ke paas, Primary School ke samne, Pipal ped..." 
                    value={formData.landmark || ''} 
                    onChange={e => setFormData({...formData, landmark: e.target.value})}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #0c831f', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none', fontWeight: 500 }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '4px', display: 'block' }}>
                    Delivery boy will ask for this landmark upon arriving in your area.
                  </span>
                </div>

                {/* Family Head / House Identification */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
                    House / Family Head Name (घर / मुखिया का नाम)
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Ramesh Pradhan ji ka ghar, Sharma ji ki chakki ke paas..." 
                    value={formData.family_head || ''} 
                    onChange={e => setFormData({...formData, family_head: e.target.value})}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                  />
                </div>

                {/* Primary & Alternate Phone */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
                      Primary Mobile (मुख्य फोन)
                    </label>
                    <input 
                      type="tel" 
                      placeholder="9876543210" 
                      value={formData.phone || ''} 
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
                      Alternate Phone (वैकल्पिक)
                    </label>
                    <input 
                      type="tel" 
                      placeholder="Ghar ka dusra no." 
                      value={formData.alt_phone || ''} 
                      onChange={e => setFormData({...formData, alt_phone: e.target.value})}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Additional Details */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-light)', marginBottom: 6 }}>
                    Full Address Notes / Complete Description (Optional)
                  </label>
                  <textarea 
                    placeholder="Any specific delivery instructions or house details..." 
                    value={formData.details || ''} 
                    onChange={e => setFormData({...formData, details: e.target.value})}
                    rows={2}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>

                <div style={{display: 'flex', gap: 12, marginTop: 8}}>
                  <button onClick={() => setStep(1)} className="zipit-premium-btn-secondary" style={{flex: 1}}>Back to Map</button>
                  <button onClick={handleSave} disabled={loading} className="zipit-premium-btn-primary" style={{flex: 1, opacity: loading ? 0.7 : 1}}>{loading ? 'Saving...' : 'Save Village Address'}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default SavedAddressesPage;
