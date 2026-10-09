import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Key, Store, Bike, LogOut, ShieldCheck, Mail, FileText, Lock, ArrowLeft, MapPin, Check } from 'lucide-react';
import { auth } from '../services/auth';
import { supabase } from '../services/db';
import './ProfilePage.css';

export default function ProfilePage() {
  const role = auth.getRole() || 'shopkeeper';
  const code = auth.getCode() || 'N/A';
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shopAddress, setShopAddress] = useState('');
  const [shopLandmark, setShopLandmark] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchProfileDetails = async () => {
      setLoading(true);
      if (code && code !== 'N/A') {
        const { data } = await supabase
          .from('access_codes')
          .select('*')
          .eq('code', code)
          .single();
          
        if (data) {
          setProfileData(data);
          setShopAddress(data.shop_address || '');
          setShopLandmark(data.shop_landmark || '');
        }
      }
      setLoading(false);
    };

    fetchProfileDetails();
  }, [code]);

  const handleSaveShopAddress = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from('access_codes')
      .update({
        shop_address: shopAddress.trim(),
        shop_landmark: shopLandmark.trim()
      })
      .eq('code', code);

    setIsSaving(false);
    if (!error) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      alert('Error updating store address: ' + error.message);
    }
  };

  const handleLogout = () => {
    auth.logout();
  };

  const displayName = profileData?.name || (role === 'shopkeeper' ? 'Shop Manager' : 'Delivery Rider');
  const displayMobile = profileData?.mobile || 'N/A';
  const displayAadhar = profileData?.aadhar ? profileData.aadhar : 'N/A';
  const displayEmail = profileData?.email || 'N/A';
  const displayFssai = profileData?.fssai || 'Not Specified';
  const displayVehicleNo = profileData?.vehicle_no || 'N/A';

  return (
    <div className="profile-page-container">
      {/* Top Back Navigation Bar */}
      <div className="profile-top-nav">
        <button className="back-nav-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={20} /> Back to Orders
        </button>
      </div>

      <div className="profile-card">
        {/* Avatar Header */}
        <div className="profile-avatar-header">
          <div className="avatar-circle">
            <User size={48} color="#0f172a" />
          </div>
          <h2>{loading ? 'Loading Profile...' : displayName}</h2>
          <span className={`role-badge ${role}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {role === 'shopkeeper' ? <><Store size={14} /> Shopkeeper</> : <><Bike size={14} /> Delivery Partner</>}
          </span>
        </div>

        {/* Readonly Notice Banner */}
        <div className="readonly-admin-banner">
          <Lock size={16} />
          <span>Profile details are linked to code <strong>{code}</strong> and managed by Admin.</span>
        </div>

        {/* Read-Only Profile Details */}
        <div className="profile-form">
          <div className="form-group readonly">
            <label><User size={16} /> Full Name</label>
            <input type="text" value={displayName} readOnly />
          </div>

          <div className="form-group readonly">
            <label><Phone size={16} /> Mobile Number</label>
            <input type="text" value={displayMobile} readOnly />
          </div>

          <div className="form-group readonly">
            <label><ShieldCheck size={16} /> Aadhar Number</label>
            <input type="text" value={displayAadhar} readOnly />
          </div>

          <div className="form-group readonly">
            <label><Mail size={16} /> Email ID</label>
            <input type="email" value={displayEmail} readOnly />
          </div>

          {role === 'shopkeeper' ? (
            <>
              <div className="form-group readonly">
                <label><FileText size={16} /> FSSAI Number</label>
                <input type="text" value={displayFssai} readOnly />
              </div>

              {/* Editable Dark Store Address */}
              <div className="form-group" style={{ background: '#f8fafc', padding: '14px', borderRadius: '16px', border: '1.5px solid #e2e8f0' }}>
                <label style={{ color: '#0f172a', fontWeight: '800' }}>
                  <MapPin size={16} color="#2563eb" /> Shop / Dark Store Address
                </label>
                <textarea
                  rows={2}
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  placeholder="e.g. Plot No. 12, Main Market, Ghazipur, UP"
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    fontFamily: 'inherit',
                    resize: 'none',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                />

                <label style={{ color: '#0f172a', fontWeight: '800', marginTop: '6px' }}>
                  Nearby Landmark
                </label>
                <input
                  type="text"
                  value={shopLandmark}
                  onChange={(e) => setShopLandmark(e.target.value)}
                  placeholder="e.g. Near City Hospital / Opp. Post Office"
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                />

                <button
                  type="button"
                  onClick={handleSaveShopAddress}
                  disabled={isSaving}
                  style={{
                    marginTop: '10px',
                    background: saveSuccess ? '#16a34a' : 'var(--color-primary, #F8CB46)',
                    color: saveSuccess ? '#ffffff' : '#000000',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {saveSuccess ? (
                    <>
                      <Check size={16} /> Saved Successfully
                    </>
                  ) : (
                    isSaving ? 'Saving...' : 'Save Shop Address'
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="form-group readonly">
              <label><Bike size={16} /> Vehicle Number</label>
              <input type="text" value={displayVehicleNo} readOnly style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800' }} />
            </div>
          )}

          <div className="form-group readonly">
            <label><Key size={16} /> 8-Digit Access Code</label>
            <input type="text" value={code} readOnly style={{ fontFamily: 'monospace', fontWeight: '800', letterSpacing: '1px' }} />
          </div>

          <div className="profile-actions">
            <button type="button" onClick={handleLogout} className="logout-btn">
              <LogOut size={18} /> Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
