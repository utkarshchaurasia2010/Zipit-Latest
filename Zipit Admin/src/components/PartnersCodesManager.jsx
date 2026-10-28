import React, { useState, useEffect } from 'react';
import { supabase } from '../services/db';
import { 
  Plus, 
  Trash2, 
  Key, 
  X, 
  CheckSquare, 
  User, 
  Phone, 
  ShieldCheck, 
  Mail, 
  FileText, 
  Truck, 
  Eye, 
  Store, 
  Bike, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Search, 
  Filter,
  Users,
  Check,
  Building,
  MapPin,
  Sparkles
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function PartnersCodesManager() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'shopkeeper', 'rider', 'applications'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewingPartner, setViewingPartner] = useState(null);
  const [reviewingApp, setReviewingApp] = useState(null);
  const [isProcessingApp, setIsProcessingApp] = useState(false);

  // Form State for Manual Creation
  const [role, setRole] = useState('shopkeeper');
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    aadhar: '',
    email: '',
    fssai: '',
    vehicle_no: '',
    shop_address: '',
    shop_landmark: '',
    agreed_terms: false
  });

  const { showToast } = useToast();

  const fetchCodes = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('access_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      showToast(error.message, 'error');
    } else {
      setCodes(data || []);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    fetchCodes();

    // Realtime listener for live synchronization when new applications arrive
    const channel = supabase
      .channel('partners-codes-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_codes' }, (payload) => {
        if (payload.eventType === 'INSERT' && (payload.new?.label?.includes('Application') || payload.new?.code?.startsWith('APP-'))) {
          showToast(`New ${payload.new.role === 'shopkeeper' ? 'Retailer' : 'Rider'} application received: ${payload.new.name}`, 'info');
        }
        fetchCodes(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const generateRandomCode = (rolePrefix) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const resetForm = () => {
    setFormData({
      name: '',
      mobile: '',
      aadhar: '',
      email: '',
      fssai: '',
      vehicle_no: '',
      shop_address: '',
      shop_landmark: '',
      agreed_terms: false
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.mobile || !formData.aadhar || !formData.email) {
      showToast('Please fill in all compulsory fields (*)', 'error');
      return;
    }

    if (role === 'rider' && !formData.vehicle_no) {
      showToast('Vehicle Number is compulsory for Riders (*)', 'error');
      return;
    }

    if (!formData.agreed_terms) {
      showToast('You must agree to the Terms and Conditions', 'error');
      return;
    }

    setIsGenerating(true);
    const newCode = generateRandomCode(role);

    const payload = {
      code: newCode,
      role: role,
      name: formData.name.trim(),
      mobile: formData.mobile.trim(),
      aadhar: formData.aadhar.trim(),
      email: formData.email.trim(),
      fssai: role === 'shopkeeper' ? (formData.fssai.trim() || null) : null,
      vehicle_no: role === 'rider' ? (formData.vehicle_no.trim() || null) : null,
      shop_address: role === 'shopkeeper' ? (formData.shop_address?.trim() || null) : null,
      shop_landmark: role === 'shopkeeper' ? (formData.shop_landmark?.trim() || null) : null,
      label: 'Verified Partner',
      is_active: true,
      agreed_terms: true
    };

    const { error } = await supabase.from('access_codes').insert([payload]);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(`Successfully registered ${role === 'shopkeeper' ? 'Retail Partner' : 'Delivery Partner'}: ${newCode}`, 'success');
      setIsModalOpen(false);
      resetForm();
      fetchCodes(true);
    }
    setIsGenerating(false);
  };

  const handleDelete = async (codeToDelete) => {
    if (!window.confirm(`Are you sure you want to delete partner code ${codeToDelete}?`)) return;

    const { error } = await supabase.from('access_codes').delete().eq('code', codeToDelete);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Partner deleted successfully', 'success');
      fetchCodes(true);
    }
  };

  const handleToggleStatus = async (partner) => {
    const newStatus = partner.is_active === false ? true : false;
    const { error } = await supabase
      .from('access_codes')
      .update({ is_active: newStatus })
      .eq('code', partner.code);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(`Partner #${partner.code} is now ${newStatus ? 'ACTIVE' : 'INACTIVE'}`, 'success');
      fetchCodes(true);
    }
  };

  // Review & Approve an online applicant
  const handleApproveApplication = async (app) => {
    setIsProcessingApp(true);
    try {
      const officialCode = generateRandomCode(app.role);

      // Delete old pending row and insert official verified code row (to avoid code PK issues)
      const { error: delErr } = await supabase.from('access_codes').delete().eq('code', app.code);
      if (delErr) throw delErr;

      const newRecord = {
        ...app,
        code: officialCode,
        label: 'Verified Partner',
        is_active: true,
        updated_at: new Date().toISOString()
      };
      delete newRecord.id;

      const { error: insErr } = await supabase.from('access_codes').insert([newRecord]);
      if (insErr) throw insErr;

      showToast(`Application Approved! Generated official Partner Code: ${officialCode}`, 'success');
      setReviewingApp(null);
      fetchCodes(true);
    } catch (e) {
      showToast('Approval error: ' + e.message, 'error');
    } finally {
      setIsProcessingApp(false);
    }
  };

  const handleRejectApplication = async (app) => {
    if (!window.confirm(`Are you sure you want to reject and remove application from ${app.name}?`)) return;
    setIsProcessingApp(true);
    try {
      const { error } = await supabase.from('access_codes').delete().eq('code', app.code);
      if (error) throw error;
      showToast(`Application from ${app.name} rejected and removed.`, 'info');
      setReviewingApp(null);
      fetchCodes(true);
    } catch (e) {
      showToast('Rejection error: ' + e.message, 'error');
    } finally {
      setIsProcessingApp(false);
    }
  };

  // Helper checks
  const isApplication = (item) => {
    return (item.code && item.code.startsWith('APP-')) || 
           (item.label && item.label.includes('Application')) ||
           (item.label && item.label.includes('Pending'));
  };

  // Counters
  const applicationsCount = codes.filter(isApplication).length;
  const shopkeepersCount = codes.filter(c => c.role === 'shopkeeper' && !isApplication(c)).length;
  const ridersCount = codes.filter(c => c.role === 'rider' && !isApplication(c)).length;
  const totalVerifiedCount = codes.filter(c => !isApplication(c)).length;

  // Filtered List
  const filteredCodes = codes.filter(c => {
    const isApp = isApplication(c);

    // Tab Filter
    if (activeTab === 'applications' && !isApp) return false;
    if (activeTab === 'shopkeeper' && (c.role !== 'shopkeeper' || isApp)) return false;
    if (activeTab === 'rider' && (c.role !== 'rider' || isApp)) return false;
    if (activeTab === 'all' && isApp) return false; // In 'all', show verified partners only, applications in their dedicated queue

    // Status Filter
    if (statusFilter === 'active' && c.is_active === false) return false;
    if (statusFilter === 'inactive' && c.is_active !== false) return false;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchMobile = c.mobile?.includes(q);
      const matchCode = c.code?.toLowerCase().includes(q);
      const matchAadhar = c.aadhar?.includes(q);
      const matchAddress = c.shop_address?.toLowerCase().includes(q);
      const matchVehicle = c.vehicle_no?.toLowerCase().includes(q);
      return matchName || matchMobile || matchCode || matchAadhar || matchAddress || matchVehicle;
    }

    return true;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1360px', margin: '0 auto', color: 'var(--color-text)' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--color-text)', margin: 0, letterSpacing: '-0.5px' }}>
              Partners Codes & Onboarding
            </h1>
            {applicationsCount > 0 && (
              <span style={{ 
                background: '#fef2f2', 
                color: '#dc2626', 
                border: '1px solid #fecaca', 
                padding: '3px 10px', 
                borderRadius: '20px', 
                fontSize: '12px', 
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                animation: 'pulse 2s infinite'
              }}>
                <Sparkles size={13} /> {applicationsCount} New Application{applicationsCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--color-text-light)', margin: '6px 0 0', fontSize: '14px' }}>
            Manage Retail Partners (Shopkeepers), Delivery Partners (Riders), verify companion applications, and control access permissions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            style={{
              background: '#0c831f',
              color: '#ffffff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(12, 131, 31, 0.25)',
              transition: 'transform 0.15s ease'
            }}
          >
            <Plus size={18} /> Generate Partner Code
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        borderBottom: '1px solid var(--color-border)', 
        paddingBottom: '12px', 
        marginBottom: '20px',
        overflowX: 'auto',
        scrollbarWidth: 'none'
      }}>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            background: activeTab === 'all' ? 'var(--color-surface-muted)' : 'transparent',
            color: activeTab === 'all' ? 'var(--color-text)' : 'var(--color-text-light)',
            border: activeTab === 'all' ? '1px solid var(--color-border)' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={16} /> All Partners ({totalVerifiedCount})
        </button>

        <button
          onClick={() => setActiveTab('shopkeeper')}
          style={{
            background: activeTab === 'shopkeeper' ? 'var(--color-surface-muted)' : 'transparent',
            color: activeTab === 'shopkeeper' ? '#1e40af' : 'var(--color-text-light)',
            border: activeTab === 'shopkeeper' ? '1px solid #93c5fd' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Store size={16} /> Retail Partners ({shopkeepersCount})
        </button>

        <button
          onClick={() => setActiveTab('rider')}
          style={{
            background: activeTab === 'rider' ? 'var(--color-surface-muted)' : 'transparent',
            color: activeTab === 'rider' ? '#b45309' : 'var(--color-text-light)',
            border: activeTab === 'rider' ? '1px solid #fde68a' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Bike size={16} /> Delivery Partners ({ridersCount})
        </button>

        <button
          onClick={() => setActiveTab('applications')}
          style={{
            background: activeTab === 'applications' ? '#fef2f2' : 'transparent',
            color: activeTab === 'applications' ? '#b91c1c' : 'var(--color-text-light)',
            border: activeTab === 'applications' ? '1.5px solid #f87171' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            position: 'relative'
          }}
        >
          <FileText size={16} /> 
          Review Applications 
          {applicationsCount > 0 && (
            <span style={{ 
              background: '#dc2626', 
              color: '#ffffff', 
              padding: '1px 7px', 
              borderRadius: '999px', 
              fontSize: '11px', 
              fontWeight: 800 
            }}>
              {applicationsCount}
            </span>
          )}
        </button>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: '480px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
          <input
            type="text"
            placeholder="Search by name, phone, aadhar, code, or vehicle..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 36px',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: '13.5px',
              outline: 'none'
            }}
          />
          {searchQuery && (
            <X 
              size={15} 
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--color-text-light)' }} 
            />
          )}
        </div>

        {activeTab !== 'applications' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-light)' }}>Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive / Disabled</option>
            </select>
          </div>
        )}
      </div>

      {/* MAIN DATA TABLE / CARDS */}
      {loading ? (
        <div style={{ color: 'var(--color-text-light)', padding: '40px 0', textAlign: 'center' }}>
          Loading partners directory...
        </div>
      ) : (
        <div style={{ background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-light)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Access Code / ID</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Role Type</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Partner Name</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Contact Phone</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Identity / Vehicle</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700' }}>Status</th>
                  <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--color-text-light)' }}>
                      {activeTab === 'applications' ? (
                        <div>
                          <CheckCircle2 size={36} style={{ color: '#10b981', margin: '0 auto 10px' }} />
                          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text)' }}>No pending applications</div>
                          <div style={{ fontSize: '13px', marginTop: '4px' }}>All seller and rider companion applications have been reviewed.</div>
                        </div>
                      ) : (
                        <div>No partners found matching the filter criteria.</div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredCodes.map(partner => {
                    const isApp = isApplication(partner);
                    const isActive = partner.is_active !== false;

                    return (
                      <tr 
                        key={partner.code} 
                        style={{ 
                          borderBottom: '1px solid var(--color-border)', 
                          background: isApp ? 'rgba(254, 242, 242, 0.4)' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* CODE */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ 
                              fontFamily: 'monospace', 
                              fontWeight: '800', 
                              fontSize: isApp ? '12.5px' : '14px', 
                              color: isApp ? '#b91c1c' : '#0c831f', 
                              background: isApp ? '#fee2e2' : 'var(--color-surface-muted)', 
                              padding: '4px 10px', 
                              borderRadius: '6px', 
                              border: isApp ? '1px dashed #f87171' : '1px solid var(--color-border)' 
                            }}>
                              {partner.code}
                            </span>
                          </div>
                        </td>

                        {/* ROLE */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            background: partner.role === 'shopkeeper' ? '#dbeafe' : '#fef3c7',
                            color: partner.role === 'shopkeeper' ? '#1e40af' : '#92400e',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {partner.role === 'shopkeeper' ? <Store size={13} /> : <Bike size={13} />}
                            {partner.role === 'shopkeeper' ? 'Retail Partner' : 'Delivery Partner'}
                          </span>
                        </td>

                        {/* NAME */}
                        <td style={{ padding: '14px 16px', fontWeight: '600', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                          <div>{partner.name || 'N/A'}</div>
                          {isApp && (
                            <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700 }}>
                              Web Application (Pending)
                            </span>
                          )}
                        </td>

                        {/* PHONE */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <a href={`tel:${partner.mobile}`} style={{ color: 'var(--color-text)', textDecoration: 'none', fontWeight: 500 }}>
                            {partner.mobile || 'N/A'}
                          </a>
                        </td>

                        {/* IDENTITY / VEHICLE / ADDRESS */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', color: 'var(--color-text-light)', fontSize: '12.5px' }}>
                          {partner.role === 'rider' ? (
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{partner.vehicle_no || 'Vehicle N/A'}</span>
                            </div>
                          ) : (
                            <div style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <span>{partner.shop_address || 'Aadhaar: ' + (partner.aadhar ? '•••• ' + partner.aadhar.slice(-4) : 'N/A')}</span>
                            </div>
                          )}
                        </td>

                        {/* STATUS TOGGLE */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          {isApp ? (
                            <span style={{
                              background: '#fef3c7',
                              color: '#92400e',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <Clock size={12} /> Under Review
                            </span>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(partner)}
                                role="switch"
                                aria-checked={isActive}
                                style={{
                                  position: 'relative',
                                  width: '40px',
                                  height: '22px',
                                  borderRadius: '22px',
                                  background: isActive ? '#10b981' : '#cbd5e1',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  transition: 'background-color 0.2s ease',
                                  outline: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                                title={isActive ? 'Click to Deactivate' : 'Click to Activate'}
                              >
                                <span
                                  style={{
                                    display: 'block',
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: '#ffffff',
                                    transform: isActive ? 'translateX(18px)' : 'translateX(0px)',
                                    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                  }}
                                />
                              </button>
                              <span style={{
                                fontSize: '12px',
                                fontWeight: '700',
                                color: isActive ? '#059669' : '#94a3b8'
                              }}>
                                {isActive ? 'ACTIVE' : 'INACTIVE'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* ACTIONS */}
                        <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            {isApp ? (
                              <button
                                onClick={() => setReviewingApp(partner)}
                                style={{
                                  background: '#0c831f',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '12.5px',
                                  fontWeight: '700',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  boxShadow: '0 2px 6px rgba(12, 131, 31, 0.25)'
                                }}
                              >
                                <Check size={14} /> Review & Approve
                              </button>
                            ) : (
                              <button
                                onClick={() => setViewingPartner(partner)}
                                style={{ 
                                  background: 'var(--color-surface-muted)', 
                                  color: 'var(--color-text)', 
                                  border: '1px solid var(--color-border)', 
                                  padding: '6px 12px', 
                                  borderRadius: '8px', 
                                  cursor: 'pointer', 
                                  fontSize: '12.5px', 
                                  fontWeight: '600', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '4px' 
                                }}
                              >
                                <Eye size={14} /> Info
                              </button>
                            )}

                            <button
                              onClick={() => handleDelete(partner.code)}
                              style={{ 
                                background: '#fee2e2', 
                                color: '#ef4444', 
                                border: '1px solid #fca5a5', 
                                padding: '6px 10px', 
                                borderRadius: '8px', 
                                cursor: 'pointer', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                fontSize: '12.5px', 
                                fontWeight: '700' 
                              }}
                              title="Delete Partner"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REVIEW APPLICATION MODAL */}
      {reviewingApp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--color-surface)', color: 'var(--color-text)', borderRadius: '20px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--color-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ background: 'var(--color-surface-muted)', padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#b91c1c', letterSpacing: '0.5px' }}>
                  New Companion Application
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '2px 0 0', color: 'var(--color-text)' }}>
                  Review & Verify {reviewingApp.role === 'shopkeeper' ? 'Retail Partner' : 'Delivery Partner'}
                </h2>
              </div>
              <button onClick={() => setReviewingApp(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                <div style={{ background: 'var(--color-surface-muted)', padding: '12px 14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: 600 }}>Candidate Name</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>{reviewingApp.name}</div>
                </div>

                <div style={{ background: 'var(--color-surface-muted)', padding: '12px 14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: 600 }}>Contact Mobile</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>{reviewingApp.mobile}</div>
                </div>

                <div style={{ background: 'var(--color-surface-muted)', padding: '12px 14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: 600 }}>Aadhaar Number</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px', fontFamily: 'monospace' }}>{reviewingApp.aadhar}</div>
                </div>

                <div style={{ background: 'var(--color-surface-muted)', padding: '12px 14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: 600 }}>Email Address</div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, marginTop: '2px' }}>{reviewingApp.email}</div>
                </div>
              </div>

              {reviewingApp.role === 'shopkeeper' ? (
                <div style={{ background: 'var(--color-surface-muted)', padding: '14px', borderRadius: '10px', marginBottom: '18px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Store size={15} /> Retail Store & Location Details
                  </div>
                  <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                    <strong>Shop Address:</strong> {reviewingApp.shop_address || 'Not specified'}
                  </div>
                  <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                    <strong>Nearest Landmark:</strong> {reviewingApp.shop_landmark || 'Not specified'}
                  </div>
                  {reviewingApp.fssai && (
                    <div style={{ fontSize: '13px' }}>
                      <strong>FSSAI / Registration:</strong> {reviewingApp.fssai}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: 'var(--color-surface-muted)', padding: '14px', borderRadius: '10px', marginBottom: '18px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bike size={15} /> Delivery Fleet & Vehicle Details
                  </div>
                  <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                    <strong>Vehicle Reg. Number:</strong> {reviewingApp.vehicle_no || 'Not specified'}
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    <strong>Vehicle Type / Notes:</strong> {reviewingApp.shop_landmark || 'Standard Delivery Vehicle'}
                  </div>
                </div>
              )}

              <div style={{ fontSize: '12px', color: 'var(--color-text-light)', marginBottom: '20px' }}>
                Applied on: {new Date(reviewingApp.created_at).toLocaleString('en-IN')} • Ref ID: <code>{reviewingApp.code}</code>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  disabled={isProcessingApp}
                  onClick={() => handleRejectApplication(reviewingApp)}
                  style={{
                    flex: '1',
                    background: '#fee2e2',
                    color: '#dc2626',
                    border: '1px solid #fca5a5',
                    padding: '12px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    cursor: 'pointer'
                  }}
                >
                  Reject & Dismiss
                </button>

                <button
                  type="button"
                  disabled={isProcessingApp}
                  onClick={() => handleApproveApplication(reviewingApp)}
                  style={{
                    flex: '2',
                    background: '#0c831f',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(12, 131, 31, 0.3)'
                  }}
                >
                  {isProcessingApp ? 'Activating...' : 'Approve & Generate Active Partner Code'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PARTNER DETAILS MODAL */}
      {viewingPartner && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--color-surface)', color: 'var(--color-text)', borderRadius: '20px', width: '100%', maxWidth: '520px', overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ background: 'var(--color-surface-muted)', padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--color-text)' }}>Partner Information</h2>
                <p style={{ fontSize: '12px', color: 'var(--color-text-light)', margin: '2px 0 0' }}>Access Code: #{viewingPartner.code}</p>
              </div>
              <button onClick={() => setViewingPartner(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: 'var(--color-surface-muted)', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: 600 }}>Partner Role</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, textTransform: 'capitalize' }}>
                    {viewingPartner.role === 'shopkeeper' ? 'Retail Partner (Shopkeeper)' : 'Delivery Partner (Rider)'}
                  </div>
                </div>

                <div style={{ background: 'var(--color-surface-muted)', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: 600 }}>Status</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: viewingPartner.is_active !== false ? '#059669' : '#dc2626' }}>
                    {viewingPartner.is_active !== false ? 'Active & Authorized' : 'Disabled / Suspended'}
                  </div>
                </div>

                <div style={{ background: 'var(--color-surface-muted)', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: 600 }}>Full Name</div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{viewingPartner.name || 'N/A'}</div>
                </div>

                <div style={{ background: 'var(--color-surface-muted)', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: 600 }}>Mobile Phone</div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{viewingPartner.mobile || 'N/A'}</div>
                </div>

                <div style={{ background: 'var(--color-surface-muted)', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: 600 }}>Aadhaar Number</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>{viewingPartner.aadhar || 'N/A'}</div>
                </div>

                <div style={{ background: 'var(--color-surface-muted)', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: 600 }}>Email Address</div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{viewingPartner.email || 'N/A'}</div>
                </div>
              </div>

              {viewingPartner.role === 'shopkeeper' && (
                <div style={{ background: 'var(--color-surface-muted)', padding: '12px', borderRadius: '10px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>Shop Location & Details</div>
                  <div style={{ fontSize: '13px' }}><strong>Address:</strong> {viewingPartner.shop_address || 'N/A'}</div>
                  <div style={{ fontSize: '13px' }}><strong>Landmark:</strong> {viewingPartner.shop_landmark || 'N/A'}</div>
                  {viewingPartner.fssai && <div style={{ fontSize: '13px' }}><strong>FSSAI:</strong> {viewingPartner.fssai}</div>}
                </div>
              )}

              {viewingPartner.role === 'rider' && (
                <div style={{ background: 'var(--color-surface-muted)', padding: '12px', borderRadius: '10px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>Vehicle Information</div>
                  <div style={{ fontSize: '13px' }}><strong>Vehicle No:</strong> {viewingPartner.vehicle_no || 'N/A'}</div>
                </div>
              )}

              <div style={{ textAlign: 'right' }}>
                <button
                  onClick={() => setViewingPartner(null)}
                  style={{
                    background: 'var(--color-surface-muted)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GENERATE PARTNER CODE MODAL */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--color-surface)', color: 'var(--color-text)', borderRadius: '20px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--color-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ background: 'var(--color-surface-muted)', padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--color-text)' }}>Generate Partner Access Code</h2>
                <p style={{ fontSize: '12px', color: 'var(--color-text-light)', margin: '2px 0 0' }}>Register Retailer or Rider to generate official login ID</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ padding: '24px' }}>
              {/* ROLE SELECTION */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                <button
                  type="button"
                  onClick={() => setRole('shopkeeper')}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: role === 'shopkeeper' ? '2px solid #0c831f' : '1px solid var(--color-border)',
                    background: role === 'shopkeeper' ? '#ecfdf5' : 'var(--color-surface-muted)',
                    color: role === 'shopkeeper' ? '#047857' : 'var(--color-text)',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Store size={18} /> Retail Partner
                </button>

                <button
                  type="button"
                  onClick={() => setRole('rider')}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: role === 'rider' ? '2px solid #0c831f' : '1px solid var(--color-border)',
                    background: role === 'rider' ? '#ecfdf5' : 'var(--color-surface-muted)',
                    color: role === 'rider' ? '#047857' : 'var(--color-text)',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Bike size={18} /> Delivery Partner
                </button>
              </div>

              {/* FORM FIELDS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Mobile Phone *</label>
                    <input
                      type="tel"
                      required
                      placeholder="10-digit mobile"
                      value={formData.mobile}
                      onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Aadhaar No. *</label>
                    <input
                      type="text"
                      required
                      placeholder="12-digit Aadhaar"
                      value={formData.aadhar}
                      onChange={e => setFormData({ ...formData, aadhar: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="partner@gmail.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                  />
                </div>

                {role === 'rider' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Vehicle Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. UP61AY1234"
                      value={formData.vehicle_no}
                      onChange={e => setFormData({ ...formData, vehicle_no: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                    />
                  </div>
                )}

                {role === 'shopkeeper' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Shop Address (दुकान का पूरा पता)</label>
                      <input
                        type="text"
                        placeholder="Village, Post, Market name..."
                        value={formData.shop_address}
                        onChange={e => setFormData({ ...formData, shop_address: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>Nearest Landmark (लैंडमार्क)</label>
                      <input
                        type="text"
                        placeholder="Opposite Primary School, near temple..."
                        value={formData.shop_landmark}
                        onChange={e => setFormData({ ...formData, shop_landmark: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '5px' }}>FSSAI / Registration (Optional)</label>
                      <input
                        type="text"
                        placeholder="FSSAI certificate number..."
                        value={formData.fssai}
                        onChange={e => setFormData({ ...formData, fssai: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                      />
                    </div>
                  </>
                )}

                <div style={{ marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      required
                      checked={formData.agreed_terms}
                      onChange={e => setFormData({ ...formData, agreed_terms: e.target.checked })}
                      style={{ accentColor: '#0c831f' }}
                    />
                    <span>Partner agrees to Quickly Terms & Conditions</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ background: 'transparent', border: '1px solid var(--color-border)', padding: '10px 16px', borderRadius: '8px', color: 'var(--color-text)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  style={{ background: '#0c831f', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(12, 131, 31, 0.3)' }}
                >
                  {isGenerating ? 'Generating...' : 'Save & Generate Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
