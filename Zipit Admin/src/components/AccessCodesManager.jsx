import React, { useState, useEffect } from 'react';
import { supabase } from '../services/db';
import { Plus, Trash2, Key, X, CheckSquare, User, Phone, ShieldCheck, Mail, FileText, Truck, Eye } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function AccessCodesManager() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewingCode, setViewingCode] = useState(null);

  // Form State
  const [role, setRole] = useState('shopkeeper');
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    aadhar: '',
    email: '',
    fssai: '',
    vehicle_no: '',
    agreed_terms: false
  });

  const { showToast } = useToast();

  const fetchCodes = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('access_codes').select('*').order('created_at', { ascending: false });
    if (error) {
      showToast(error.message, 'error');
    } else {
      setCodes(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCodes();
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
      agreed_terms: true
    };

    const { error } = await supabase.from('access_codes').insert([payload]);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(`Successfully created ${role} code: ${newCode}`, 'success');
      setIsModalOpen(false);
      resetForm();
      fetchCodes();
    }
    setIsGenerating(false);
  };

  const handleDelete = async (codeToDelete) => {
    if (!window.confirm(`Are you sure you want to delete access code ${codeToDelete}?`)) return;

    const { error } = await supabase.from('access_codes').delete().eq('code', codeToDelete);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Code deleted successfully', 'success');
      fetchCodes();
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text)', margin: 0 }}>Access Codes Management</h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-light)', margin: '4px 0 0' }}>
            Generate 8-digit unique login codes for Shopkeepers and Delivery Riders
          </p>
        </div>

        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          style={{ background: 'var(--color-primary)', color: '#000', padding: '12px 20px', borderRadius: '10px', fontWeight: '700', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
        >
          <Plus size={18} /> Generate Code
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--color-text-light)', padding: '20px 0' }}>Loading access codes...</div>
      ) : (
        <div style={{ 
          background: 'var(--color-surface)', 
          borderRadius: '14px', 
          border: '1px solid var(--color-border)', 
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y',
          width: '100%',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--color-text-light)', fontSize: '13px' }}>CODE</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--color-text-light)', fontSize: '13px' }}>ROLE</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--color-text-light)', fontSize: '13px' }}>NAME</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--color-text-light)', fontSize: '13px' }}>MOBILE</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--color-text-light)', fontSize: '13px' }}>CREATED</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--color-text-light)', fontSize: '13px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-light)' }}>
                    No access codes generated yet. Click <strong>Generate Code</strong> above to create one.
                  </td>
                </tr>
              ) : (
                codes.map(c => (
                  <tr key={c.code} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '800', letterSpacing: '1px', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Key size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                        <span>{c.code}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        background: c.role === 'shopkeeper' ? '#dbeafe' : '#fef3c7',
                        color: c.role === 'shopkeeper' ? '#1e40af' : '#92400e',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '700',
                        textTransform: 'capitalize'
                      }}>
                        {c.role}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                      {c.name || 'N/A'}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>
                      {c.mobile || 'N/A'}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--color-text-light)', fontSize: '13px', whiteSpace: 'nowrap' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setViewingCode(c)}
                          style={{ background: 'var(--color-surface-muted)', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Eye size={14} /> Details
                        </button>
                        <button
                          onClick={() => handleDelete(c.code)}
                          style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: '700' }}
                          title="Delete Code"
                        >
                          <Trash2 size={15} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* GENERATE CODE MODAL FORM */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--color-surface)', color: 'var(--color-text)', borderRadius: '20px', width: '100%', maxWidth: '520px', overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ background: 'var(--color-surface-muted)', padding: '20px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--color-text)' }}>Generate New Access Code</h2>
                <p style={{ fontSize: '12px', color: 'var(--color-text-light)', margin: '2px 0 0' }}>Fill user details to generate unique 8-digit code</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Role Select Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setRole('shopkeeper')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: role === 'shopkeeper' ? '2px solid #2563eb' : '1px solid var(--color-border)',
                    background: role === 'shopkeeper' ? 'rgba(37, 99, 235, 0.12)' : 'var(--color-surface-muted)',
                    color: role === 'shopkeeper' ? '#3b82f6' : 'var(--color-text-light)',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🏪 Shopkeeper
                </button>
                <button
                  type="button"
                  onClick={() => setRole('rider')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: role === 'rider' ? '2px solid #d97706' : '1px solid var(--color-border)',
                    background: role === 'rider' ? 'rgba(217, 119, 6, 0.12)' : 'var(--color-surface-muted)',
                    color: role === 'rider' ? '#f59e0b' : 'var(--color-text-light)',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  🛵 Rider
                </button>
              </div>

              {/* Name* */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text)' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter full name"
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                />
              </div>

              {/* Mobile Number* */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text)' }}>Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="Enter 10-digit mobile number"
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                />
              </div>

              {/* Aadhar Number* */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text)' }}>Aadhar Number *</label>
                <input
                  type="text"
                  required
                  value={formData.aadhar}
                  onChange={(e) => setFormData({ ...formData, aadhar: e.target.value })}
                  placeholder="Enter 12-digit Aadhar number"
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                />
              </div>

              {/* Email ID* */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text)' }}>Email ID *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email address"
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                />
              </div>

              {/* FSSAI Number (Shopkeeper only, optional) */}
              {role === 'shopkeeper' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text)' }}>FSSAI Number <span style={{ fontWeight: '400', color: 'var(--color-text-light)' }}>(Optional)</span></label>
                  <input
                    type="text"
                    value={formData.fssai}
                    onChange={(e) => setFormData({ ...formData, fssai: e.target.value })}
                    placeholder="Enter FSSAI license number (if available)"
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none' }}
                  />
                </div>
              )}

              {/* Vehicle Number (Rider only, compulsory) */}
              {role === 'rider' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text)' }}>Vehicle Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.vehicle_no}
                    onChange={(e) => setFormData({ ...formData, vehicle_no: e.target.value.toUpperCase() })}
                    placeholder="e.g. UP-65-AB-1234"
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface-muted)', color: 'var(--color-text)', outline: 'none', textTransform: 'uppercase' }}
                  />
                </div>
              )}

              {/* Terms Checkbox* */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="agree_terms"
                  required
                  checked={formData.agreed_terms}
                  onChange={(e) => setFormData({ ...formData, agreed_terms: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="agree_terms" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text)', cursor: 'pointer' }}>
                  I agree to the Terms & Conditions and certify the information is valid *
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isGenerating}
                style={{ background: 'var(--color-primary)', color: '#000000', padding: '14px', borderRadius: '10px', fontWeight: '800', border: 'none', cursor: 'pointer', marginTop: '8px', fontSize: '15px' }}
              >
                {isGenerating ? 'Generating...' : `Generate 8-Digit ${role.toUpperCase()} Code`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {viewingCode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--color-surface)', color: 'var(--color-text)', borderRadius: '20px', width: '100%', maxWidth: '440px', padding: '24px', border: '1px solid var(--color-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--color-text)' }}>User Profile Details</h3>
              <button onClick={() => setViewingCode(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface-muted)', padding: '16px', borderRadius: '12px', fontSize: '14px', border: '1px solid var(--color-border)' }}>
              <div><strong style={{ color: 'var(--color-text-light)' }}>Code:</strong> <code style={{ background: 'var(--color-primary)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontWeight: '800', marginLeft: '6px' }}>{viewingCode.code}</code></div>
              <div><strong style={{ color: 'var(--color-text-light)' }}>Role:</strong> <span style={{ textTransform: 'capitalize', fontWeight: '700', marginLeft: '6px' }}>{viewingCode.role}</span></div>
              <div><strong style={{ color: 'var(--color-text-light)' }}>Name:</strong> <span style={{ marginLeft: '6px' }}>{viewingCode.name || 'N/A'}</span></div>
              <div><strong style={{ color: 'var(--color-text-light)' }}>Mobile:</strong> <span style={{ marginLeft: '6px' }}>{viewingCode.mobile || 'N/A'}</span></div>
              <div><strong style={{ color: 'var(--color-text-light)' }}>Aadhar:</strong> <span style={{ marginLeft: '6px' }}>{viewingCode.aadhar || 'N/A'}</span></div>
              <div><strong style={{ color: 'var(--color-text-light)' }}>Email:</strong> <span style={{ marginLeft: '6px' }}>{viewingCode.email || 'N/A'}</span></div>
              {viewingCode.role === 'shopkeeper' && <div><strong style={{ color: 'var(--color-text-light)' }}>FSSAI No:</strong> <span style={{ marginLeft: '6px' }}>{viewingCode.fssai || 'Not provided'}</span></div>}
              {viewingCode.role === 'rider' && <div><strong style={{ color: 'var(--color-text-light)' }}>Vehicle No:</strong> <span style={{ marginLeft: '6px' }}>{viewingCode.vehicle_no || 'N/A'}</span></div>}
              <div><strong style={{ color: 'var(--color-text-light)' }}>Created:</strong> <span style={{ marginLeft: '6px' }}>{new Date(viewingCode.created_at).toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
