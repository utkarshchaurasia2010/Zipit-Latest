import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Key, Store, Bike, LogOut, ShieldCheck, Mail, FileText, Lock, ArrowLeft } from 'lucide-react';
import { auth } from '../services/auth';
import { supabase } from '../services/db';
import './ProfilePage.css';

export default function ProfilePage() {
  const role = auth.getRole() || 'shopkeeper';
  const code = auth.getCode() || 'N/A';
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

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
        }
      }
      setLoading(false);
    };

    fetchProfileDetails();
  }, [code]);

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
          <span className={`role-badge ${role}`}>
            {role === 'shopkeeper' ? '🏪 Shopkeeper' : '🛵 Delivery Partner'}
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
            <div className="form-group readonly">
              <label><FileText size={16} /> FSSAI Number</label>
              <input type="text" value={displayFssai} readOnly />
            </div>
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
