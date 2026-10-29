import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Store, 
  Bike, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles, 
  ArrowLeft, 
  Send, 
  Phone, 
  Mail, 
  User, 
  FileText, 
  Building, 
  MapPin, 
  HelpCircle,
  Truck,
  IndianRupee,
  Clock,
  Award
} from 'lucide-react';
import { supabase } from '../services/db';
import { useToast } from '../context/ToastContext';
import './PartnerRegistrationPage.css';

export default function PartnerRegistrationPage({ navigate }) {
  const { showToast } = useToast();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialRole = location.state?.role || searchParams.get('role') || 'shopkeeper';
  const [role, setRole] = useState(initialRole === 'rider' ? 'rider' : 'shopkeeper');
  const [submittedApp, setSubmittedApp] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    aadhar: '',
    shop_name: '',
    shop_address: '',
    shop_landmark: '',
    fssai: '',
    vehicle_type: 'Motorcycle',
    vehicle_no: '',
    driving_license_no: '',
    delivery_area: '',
    agreed_terms: false
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validations
    if (!formData.name.trim() || !formData.mobile.trim() || !formData.email.trim() || !formData.aadhar.trim()) {
      showToast('Please fill all mandatory personal details (*)', 'error');
      return;
    }

    if (formData.mobile.trim().length < 10) {
      showToast('Please enter a valid 10-digit mobile number', 'error');
      return;
    }

    if (formData.aadhar.trim().length < 12) {
      showToast('Please enter a valid 12-digit Aadhaar number', 'error');
      return;
    }

    if (role === 'shopkeeper' && (!formData.shop_address.trim() || !formData.shop_landmark.trim())) {
      showToast('Shop address and landmark are required for retail partners (*)', 'error');
      return;
    }

    const isBicycle = role === 'rider' && formData.vehicle_type === 'Bicycle';

    if (role === 'rider' && !isBicycle && !formData.vehicle_no.trim()) {
      showToast('Vehicle registration number is required for motorized delivery partners (*)', 'error');
      return;
    }

    if (!formData.agreed_terms) {
      showToast('Please agree to the Quickly Partner Terms & Conditions', 'error');
      return;
    }

    // 1. Client-side 24-hour rate limit check
    const lastSubTime = localStorage.getItem('zipit_last_partner_app_time');
    if (lastSubTime) {
      const elapsedHours = (Date.now() - Number(lastSubTime)) / (1000 * 60 * 60);
      if (elapsedHours < 24) {
        const remainingHours = Math.ceil(24 - elapsedHours);
        showToast(`Only 1 application per IP / device is permitted in 24 hours. Please wait ${remainingHours} hours before applying again.`, 'error');
        return;
      }
    }

    setLoading(true);

    try {
      // 2. Fetch Client IP Address for strict 24-hour network rate limiting
      let clientIp = null;
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json').then(r => r.json());
        clientIp = ipRes?.ip;
      } catch (_) {
        try {
          const ipRes2 = await fetch('https://ipapi.co/json/').then(r => r.json());
          clientIp = ipRes2?.ip;
        } catch (_) {}
      }

      // 3. Database rate limit check: Only 1 application per IP address in 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      if (clientIp) {
        const { data: recentIpApps } = await supabase
          .from('access_codes')
          .select('code, created_at, label')
          .gte('created_at', twentyFourHoursAgo)
          .like('label', `%---IP:${clientIp}---%`);

        if (recentIpApps && recentIpApps.length > 0) {
          showToast('Only 1 partner application per IP address is permitted in 24 hours. An application was already submitted from this network.', 'error');
          setLoading(false);
          return;
        }
      }

      // 4. Also prevent duplicate mobile or Aadhaar in last 24 hours
      const { data: recentIdentities } = await supabase
        .from('access_codes')
        .select('code, mobile, aadhar')
        .gte('created_at', twentyFourHoursAgo)
        .or(`mobile.eq.${formData.mobile.trim()},aadhar.eq.${formData.aadhar.trim()}`);

      if (recentIdentities && recentIdentities.length > 0) {
        showToast('An application with this mobile number or Aadhaar was already submitted in the last 24 hours.', 'error');
        setLoading(false);
        return;
      }

      // Generate unique application tracking code
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const appCode = `APP-${randomSuffix}`;

      const payload = {
        code: appCode,
        role: role,
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        email: formData.email.trim(),
        aadhar: formData.aadhar.trim(),
        store_name: role === 'shopkeeper' ? (formData.shop_name.trim() || null) : null,
        fssai: role === 'shopkeeper' ? (formData.fssai.trim() || null) : null,
        shop_address: role === 'shopkeeper' ? formData.shop_address.trim() : null,
        shop_landmark: role === 'shopkeeper' ? formData.shop_landmark.trim() : null,
        vehicle_type: role === 'rider' ? formData.vehicle_type : null,
        vehicle_no: role === 'rider' && !isBicycle ? (formData.vehicle_no.trim() || null) : (isBicycle ? 'BICYCLE' : null),
        driving_license_no: role === 'rider' && !isBicycle ? (formData.driving_license_no.trim() || null) : null,
        delivery_area: role === 'rider' ? (formData.delivery_area.trim() || null) : null,
        label: `Online Application - Pending Review${clientIp ? ` ---IP:${clientIp}---` : ''}`,
        is_active: false, // Locked until Admin verifies in Partners section
        agreed_terms: true
      };

      let { error: insertError } = await supabase.from('access_codes').insert([payload]);

      // Fallback if schema columns haven't been added yet in database
      if (insertError && insertError.message && (
        insertError.message.includes('column') || 
        insertError.message.includes('store_name') || 
        insertError.message.includes('vehicle_type') ||
        insertError.message.includes('driving_license_no') ||
        insertError.message.includes('delivery_area')
      )) {
        const fallbackPayload = {
          code: appCode,
          role: role,
          name: formData.name.trim(),
          mobile: formData.mobile.trim(),
          email: formData.email.trim(),
          aadhar: formData.aadhar.trim(),
          fssai: role === 'shopkeeper' ? (formData.fssai.trim() || null) : null,
          vehicle_no: role === 'rider' && !isBicycle ? (formData.vehicle_no.trim() || null) : (isBicycle ? 'BICYCLE' : null),
          shop_address: role === 'shopkeeper' 
            ? `${formData.shop_name ? `[${formData.shop_name}] ` : ''}${formData.shop_address.trim()}`
            : (formData.delivery_area.trim() || null),
          shop_landmark: role === 'shopkeeper' 
            ? formData.shop_landmark.trim() 
            : `${formData.vehicle_type}${formData.driving_license_no ? ` (DL: ${formData.driving_license_no})` : ''}`,
          label: `Online Application - Pending Review${clientIp ? ` ---IP:${clientIp}---` : ''}`,
          is_active: false,
          agreed_terms: true
        };
        const { error: fallbackError } = await supabase.from('access_codes').insert([fallbackPayload]);
        insertError = fallbackError;
      }

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Record rate limit in localStorage
      localStorage.setItem('zipit_last_partner_app_time', String(Date.now()));
      if (clientIp) localStorage.setItem('zipit_last_partner_app_ip', clientIp);

      setSubmittedApp({
        code: appCode,
        name: formData.name,
        role: role,
        mobile: formData.mobile
      });

      showToast('Application successfully submitted! Admin will review shortly.', 'success');
    } catch (err) {
      console.error('Partner registration error:', err);
      showToast('Submission error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="partner-reg-container">
      {/* Top Bar */}
      <div className="partner-reg-topbar">
        <button onClick={() => navigate ? navigate('/') : window.history.back()} className="partner-back-btn">
          <ArrowLeft size={18} /> Back to Shopping
        </button>
      </div>

      {submittedApp ? (
        /* SUCCESS RECEIPT VIEW */
        <div className="partner-success-card">
          <div className="success-icon-badge">
            <CheckCircle2 size={48} color="#0c831f" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text)', margin: '16px 0 8px' }}>
            Application Submitted!
          </h2>
          <p style={{ color: 'var(--color-text-light)', fontSize: '14.5px', lineHeight: '1.5', maxWidth: '440px', margin: '0 auto 20px' }}>
            Thank you, <strong>{submittedApp.name}</strong>! Your application to become a <strong>{submittedApp.role === 'shopkeeper' ? 'Retail Partner (Shopkeeper)' : 'Delivery Partner (Rider)'}</strong> in Quickly has been registered.
          </p>

          <div className="partner-ref-box">
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Application Reference ID
            </span>
            <div style={{ fontSize: '22px', fontWeight: 900, fontFamily: 'monospace', color: '#0c831f', marginTop: '4px' }}>
              {submittedApp.code}
            </div>
            <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
              Keep this ID for tracking your onboarding status
            </span>
          </div>

          <div className="partner-steps-list">
            <div className="step-item">
              <span className="step-num">1</span>
              <div>
                <strong>Admin Review (24-48 Hours)</strong>
                <p>Quickly team reviews your Aadhaar and location details in our Partners portal.</p>
              </div>
            </div>
            <div className="step-item">
              <span className="step-num">2</span>
              <div>
                <strong>Partner Code Activation</strong>
                <p>Upon verification, your official Access Code will be authorized for instant login.</p>
              </div>
            </div>
            <div className="step-item">
              <span className="step-num">3</span>
              <div>
                <strong>Start Earning</strong>
                <p>Fulfill orders or start delivery drops with weekly digital settlements.</p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button 
              onClick={() => navigate ? navigate('/') : (window.location.href = '/')} 
              className="partner-primary-btn"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      ) : (
        /* REGISTRATION FORM VIEW */
        <div className="partner-form-wrapper">
          {/* Hero Banner */}
          <div className="partner-hero-banner">
            <h1>Partner with Quickly</h1>
            <p>Grow your business or earn with every delivery across rural and semi-urban India.</p>
            
            {/* Perks Cards */}
            <div className="partner-perks-row">
              <div className="perk-badge">
                <IndianRupee size={15} /> Daily Settlements
              </div>
              <div className="perk-badge">
                <Award size={15} /> Zero Joining Fee
              </div>
              <div className="perk-badge">
                <Clock size={15} /> Flexible Schedule
              </div>
              <div className="perk-badge">
                <ShieldCheck size={15} /> Verified Local Network
              </div>
            </div>
          </div>

          {/* Role Switcher */}
          <div className="partner-role-switch">
            <button
              type="button"
              className={`role-tab-btn ${role === 'shopkeeper' ? 'active' : ''}`}
              onClick={() => setRole('shopkeeper')}
            >
              <Store size={20} />
              <div>
                <span className="role-btn-title">Retail Partner (Shopkeeper)</span>
                <span className="role-btn-sub">दुकानदार / सेलर पार्टनर बनें</span>
              </div>
            </button>

            <button
              type="button"
              className={`role-tab-btn ${role === 'rider' ? 'active' : ''}`}
              onClick={() => setRole('rider')}
            >
              <Bike size={20} />
              <div>
                <span className="role-btn-title">Delivery Partner (Rider)</span>
                <span className="role-btn-sub">राइडर / डिलीवरी पार्टनर बनें</span>
              </div>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="partner-main-form">
            <div className="form-section-title">
              <User size={18} /> Personal Identification (व्यक्तिगत जानकारी)
            </div>

            <div className="form-grid-2">
              <div className="form-field">
                <label>Full Name (पूरा नाम) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Mobile Number (मोबाइल नंबर) *</label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit phone"
                  value={formData.mobile}
                  onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-field">
                <label>Email Address (ईमेल) *</label>
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label>Aadhaar Card Number (आधार नंबर) *</label>
                <input
                  type="text"
                  required
                  placeholder="12-digit Aadhaar"
                  value={formData.aadhar}
                  onChange={e => setFormData({ ...formData, aadhar: e.target.value })}
                />
              </div>
            </div>

            {/* SHOPKEEPER SPECIFIC FIELDS */}
            {role === 'shopkeeper' && (
              <>
                <div className="form-section-title" style={{ marginTop: '20px' }}>
                  <Building size={18} /> Retail Store & Location Details (दुकान का विवरण)
                </div>

                <div className="form-field">
                  <label>Store / Business Name (दुकान का नाम)</label>
                  <input
                    type="text"
                    placeholder="e.g. Shri Balaji Kirana Store"
                    value={formData.shop_name}
                    onChange={e => setFormData({ ...formData, shop_name: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>Complete Shop Address with Village / Town (दुकान का पूरा पता) *</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Village, Post, Block, Market name..."
                    value={formData.shop_address}
                    onChange={e => setFormData({ ...formData, shop_address: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label>Nearest Landmark (नजदीकी लैंडमार्क) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Opposite Primary School, near temple..."
                      value={formData.shop_landmark}
                      onChange={e => setFormData({ ...formData, shop_landmark: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label>FSSAI / Shop Registration (Optional)</label>
                    <input
                      type="text"
                      placeholder="FSSAI certificate number if any"
                      value={formData.fssai}
                      onChange={e => setFormData({ ...formData, fssai: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* RIDER SPECIFIC FIELDS */}
            {role === 'rider' && (
              <>
                <div className="form-section-title" style={{ marginTop: '20px' }}>
                  <Truck size={18} /> Delivery Fleet & Vehicle Information (वाहन विवरण)
                </div>

                <div className="form-field">
                  <label>Vehicle Type (वाहन का प्रकार) *</label>
                  <select
                    value={formData.vehicle_type}
                    onChange={e => {
                      const vType = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        vehicle_type: vType,
                        ...(vType === 'Bicycle' ? { vehicle_no: '', driving_license_no: '' } : {})
                      }));
                    }}
                  >
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="Scooter">Scooter</option>
                    <option value="Electric Two-wheeler">Electric Two-wheeler</option>
                    <option value="Bicycle">Bicycle</option>
                  </select>
                </div>

                {formData.vehicle_type !== 'Bicycle' ? (
                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>Vehicle Reg. Number (गाड़ी का नंबर) *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. UP61AY1234"
                        value={formData.vehicle_no}
                        onChange={e => setFormData({ ...formData, vehicle_no: e.target.value.toUpperCase() })}
                      />
                    </div>

                    <div className="form-field">
                      <label>Driving License No. (ड्राइविंग लाइसेंस) *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. DL-0420110012345"
                        value={formData.driving_license_no}
                        onChange={e => setFormData({ ...formData, driving_license_no: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #bbf7d0',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    margin: '6px 0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#166534',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}>
                    <span style={{ fontSize: '20px' }}>🚲</span>
                    <div>
                      <strong>Bicycle Selected:</strong> No vehicle registration number or driving license is required to deliver on bicycle!
                    </div>
                  </div>
                )}

                <div className="form-field">
                  <label>Preferred Delivery Area (पसंदीदा कार्य क्षेत्र)</label>
                  <input
                    type="text"
                    placeholder="e.g. Pahetiya, Ghazipur Bazar, Ward 4..."
                    value={formData.delivery_area}
                    onChange={e => setFormData({ ...formData, delivery_area: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* Terms Agreement */}
            <div className="terms-checkbox-box">
              <label>
                <input
                  type="checkbox"
                  required
                  checked={formData.agreed_terms}
                  onChange={e => setFormData({ ...formData, agreed_terms: e.target.checked })}
                />
                <span>
                  I confirm that all provided details and documents are authentic. I agree to adhere to Quickly's Partner Operating Guidelines and service standards.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="partner-submit-btn"
            >
              {loading ? 'Submitting Application...' : (
                <>
                  <Send size={18} /> Submit Application for Admin Verification
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
