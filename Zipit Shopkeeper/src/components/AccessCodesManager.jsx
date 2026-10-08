import React, { useState, useEffect } from 'react';
import { supabase } from '../services/db';
import { Plus, Trash2, Key } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function AccessCodesManager() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newRole, setNewRole] = useState('shopkeeper');
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

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreate = async () => {
    setIsGenerating(true);
    const newCode = generateCode();
    
    const { error } = await supabase.from('access_codes').insert([
      { code: newCode, role: newRole }
    ]);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(`Created new code: ${newCode}`, 'success');
      fetchCodes();
    }
    setIsGenerating(false);
  };

  const handleDelete = async (codeToDelete) => {
    if (!window.confirm(`Are you sure you want to delete the code ${codeToDelete}?`)) return;
    
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
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text)' }}>Access Codes</h1>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select 
            value={newRole} 
            onChange={(e) => setNewRole(e.target.value)}
            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none' }}
          >
            <option value="shopkeeper">Shopkeeper</option>
            <option value="rider">Rider</option>
          </select>
          <button 
            onClick={handleCreate} 
            disabled={isGenerating}
            style={{ background: 'var(--color-primary)', color: '#000', padding: '10px 16px', borderRadius: '8px', fontWeight: '700', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={18} /> {isGenerating ? 'Generating...' : 'Generate Code'}
          </button>
        </div>
      </div>

      {loading ? (
        <div>Loading codes...</div>
      ) : (
        <div style={{ background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-muted)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '16px', fontWeight: '600', color: 'var(--color-text-light)' }}>Code</th>
                <th style={{ padding: '16px', fontWeight: '600', color: 'var(--color-text-light)' }}>Role</th>
                <th style={{ padding: '16px', fontWeight: '600', color: 'var(--color-text-light)' }}>Created</th>
                <th style={{ padding: '16px', fontWeight: '600', color: 'var(--color-text-light)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-light)' }}>
                    No access codes found. Generate one to get started!
                  </td>
                </tr>
              ) : (
                codes.map(c => (
                  <tr key={c.code} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '16px', fontWeight: '700', letterSpacing: '1px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Key size={16} style={{ color: 'var(--color-primary)' }} />
                        {c.code}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ 
                        background: c.role === 'shopkeeper' ? '#dbeafe' : '#fef3c7', 
                        color: c.role === 'shopkeeper' ? '#1e40af' : '#92400e',
                        padding: '4px 12px', 
                        borderRadius: '20px', 
                        fontSize: '13px', 
                        fontWeight: '700',
                        textTransform: 'capitalize'
                      }}>
                        {c.role}
                      </span>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--color-text-light)', fontSize: '14px' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleDelete(c.code)}
                        style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
