import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, supabase } from '../services/db';
import { Plus, Edit2, Trash2, X, Upload, ArrowLeft, Filter, Check, Printer, Moon, Sun, Eye, EyeOff, Phone, MapPin, UserCheck, Bike } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import './AdminDashboard.css';

const AdminDashboard = ({ initialTab }) => {
  const [data, setData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const { showToast } = useToast();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  
  // Specific view modals
  const [viewUser, setViewUser] = useState(null);
  
  // Selector modal for Showcase/Bestsellers
  const [showSelectorModal, setShowSelectorModal] = useState(false);
  const [allProductsList, setAllProductsList] = useState([]);
  const [showSelectedGridOnly, setShowSelectedGridOnly] = useState(false);
  const [selectedBestsellerCategory, setSelectedBestsellerCategory] = useState(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (initialTab === 'products' || initialTab === 'grid-products' || initialTab === 'bestsellers') {
        const prods = await db.products.getAll();
        const cats = await db.categories.getAll();
        setCategories(cats || []);
        setAllProductsList(prods || []);
        if (initialTab === 'grid-products') {
          setData(prods || []);
        } else if (initialTab === 'bestsellers') {
          setData(cats || []);
        } else {
          setData(prods || []);
        }
      } else if (initialTab === 'orders' || initialTab === 'refunds') {
        const allOrders = await db.orders.getAllAdmin ? await db.orders.getAllAdmin() : [];
        if (initialTab === 'refunds') {
          setData(allOrders.filter(o => 
            o.status === 'Cancellation Requested' || 
            o.status === 'Refund Requested' || 
            o.status === 'Cancelled' || 
            o.status === 'Cancellation Rejected'
          ));
        } else {
          setData(allOrders);
        }
      } else if (initialTab === 'categories') {
        const cats = await db.categories.getAll();
        setData(cats || []);
      } else if (initialTab === 'banners') {
        const b = await db.WAFER.getAll();
        setData(b || []);
      } else if (initialTab === 'coupons') {
        const c = await db.coupons.getAll();
        setData(c || []);
      } else if (initialTab === 'users') {
        const users = await db.user.getAllUsers();
        setData(users || []);
      }
    } catch(e) {
      console.error(e);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadData(false);

    let channel = null;

    if (initialTab === 'orders' || initialTab === 'refunds') {
      channel = supabase
        .channel(`admin-orders-realtime-${Math.random()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          loadData(true); // Silent reload to prevent screen flashing/blinking
        })
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [initialTab]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const getSectionTitle = () => {
    switch (initialTab) {
      case 'grid-products': return 'Pinnacle Showcase';
      case 'bestsellers': return 'Bestsellers';
      case 'refunds': return 'Refunds & Cancellations';
      default: return initialTab.charAt(0).toUpperCase() + initialTab.slice(1);
    }
  };

  const openModal = async (item = null) => {
    if (!item && (initialTab === 'grid-products' || initialTab === 'bestsellers')) {
      const allProds = await db.products.getAll();
      setAllProductsList(allProds || []);
      setShowSelectorModal(true);
      return;
    }
    setEditingItem(item);
    if (initialTab === 'products' || initialTab === 'grid-products' || initialTab === 'bestsellers') {
      setFormData(item ? { ...item } : { name: '', price: '', amount: '', stock_count: -1, is_out_of_stock: false, category_id: categories[0]?.id, is_grid: initialTab === 'grid-products', is_bestseller: initialTab === 'bestsellers' });
    } else if (initialTab === 'banners') {
      setFormData(item ? { ...item } : { bg_color: '#F8CB46', order_index: 1 });
    } else if (initialTab === 'categories') {
      setFormData(item ? { ...item } : { name: '', section: 'Grocery' });
    } else if (initialTab === 'users') {
      setFormData(item ? { ...item } : { name: '', phone: '', email: '' });
    } else if (initialTab === 'coupons') {
      setFormData(item ? { ...item } : { code: '', discount_type: 'PERCENTAGE', discount_value: '', min_order_amount: 0, is_active: true });
    }
    setImageFile(null);
    setImageFiles([]);
    setIsModalOpen(true);
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setImageFile(e.target.files[0]);
      setImageFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (initialTab === 'banners' && imageFiles.length > 1 && !editingItem) {
        for (let i = 0; i < imageFiles.length; i++) {
          const url = await db.products.uploadImage(imageFiles[i]);
          await db.WAFER.add({ image_url: url, bg_color: formData.bg_color, order_index: formData.order_index + i });
        }
      } else {
        let imageUrl = formData.image_url;
        if (imageFile) {
          imageUrl = await db.products.uploadImage(imageFile);
        }
        
        const payload = { ...formData, image_url: imageUrl };
        if (initialTab === 'products' || initialTab === 'grid-products' || initialTab === 'bestsellers') {
          if (editingItem) await db.products.update(editingItem.id, payload);
          else await db.products.add(payload);
        } else if (initialTab === 'banners') {
          if (editingItem) await db.WAFER.update(editingItem.id, payload);
          else await db.WAFER.add(payload);
        } else if (initialTab === 'categories') {
          if (editingItem) await db.categories.update(editingItem.id, payload);
          else await db.categories.add(payload);
        } else if (initialTab === 'coupons') {
          if (editingItem) await db.coupons.update(editingItem.id, payload);
          else await db.coupons.add(payload);
        } else if (initialTab === 'users') {
          if(payload.email === '') delete payload.email;
          if(payload.phone === '') delete payload.phone;
          
          // Save address directly to profiles as the primary address!
          if (editingItem) {
            await supabase.from('profiles').update(payload).eq('id', editingItem.id);
          } else {
             payload.id = 'usr_' + Math.random().toString(36).substr(2, 9);
             await supabase.from('profiles').insert([payload]);
          }
        }
      }
      loadData();
      setIsModalOpen(false);
      showToast('Saved successfully!', 'success');
    } catch (err) {
      showToast('Error saving: ' + err.message, 'error');
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to remove/delete this item?')) {
      try {
        if (initialTab === 'grid-products') {
          const p = data.find(item => item.id === id);
          if (p) await supabase.from('products').update({ is_grid: false }).eq('id', id);
        } else if (initialTab === 'bestsellers') {
          const p = data.find(item => item.id === id);
          if (p) await supabase.from('products').update({ is_bestseller: false }).eq('id', id);
        } else if (initialTab === 'products') {
          await db.products.delete(id);
        } else if (initialTab === 'orders' || initialTab === 'refunds') {
          await db.orders.delete(id);
        } else if (initialTab === 'banners') {
          await db.WAFER.delete(id);
        } else if (initialTab === 'categories') {
          await db.categories.delete(id);
        } else if (initialTab === 'coupons') {
          await db.coupons.delete(id);
        } else if (initialTab === 'users') {
          await supabase.from('addresses').delete().eq('profile_id', id);
          await supabase.from('orders').delete().eq('profile_id', id);
          const { error } = await supabase.from('profiles').delete().eq('id', id);
          if (error) console.error("Error deleting user:", error);
          setData(prev => prev.filter(u => u.id !== id));
        }
        loadData();
        showToast('Removed successfully!', 'success');
      } catch (err) {
        showToast('Error deleting item', 'error');
      }
    }
  };

  const toggleAvailability = async (order, itemIndex) => {
    const updatedItems = [...order.items];
    const currentStatus = updatedItems[itemIndex].is_unavailable;
    const nextStatus = !currentStatus;

    updatedItems[itemIndex].is_unavailable = nextStatus;

    const remainingUnavailable = updatedItems.some(i => i.is_unavailable && !i.is_substituted && !i.is_refund_chosen);
    const substitutionStatus = remainingUnavailable ? 'PENDING_CUSTOMER_ACTION' : 'RESOLVED';

    await supabase.from('orders').update({
      items: updatedItems,
      substitution_status: substitutionStatus
    }).eq('id', order.id);

    loadData(true);
    showToast(
      nextStatus ? 'Marked item as unavailable.' : 'Restored item back to available stock!',
      nextStatus ? 'warning' : 'success'
    );
  };

  const printOrderReceipt = (order) => {
    const printWindow = window.open('', '_blank', 'width=520,height=750');
    if (!printWindow) return;
    
    const orderDate = new Date(order.created_at || Date.now()).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const subtotal = (order.items || []).reduce((sum, i) => sum + (i.price * i.qty), 0);
    const isRefundedOrReq = order.status === 'Refunded' || order.status === 'Refund Requested';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - Order #${order.id.slice(0,8).toUpperCase()}</title>
          <style>
            body { font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; max-width: 480px; margin: 0 auto; line-height: 1.5; font-size: 13px; }
            .bill-header { text-align: center; border-bottom: 2.5px solid #0c831f; padding-bottom: 16px; margin-bottom: 20px; }
            .bill-logo { font-size: 32px; font-weight: 900; color: #0c831f; letter-spacing: -1.5px; margin: 0; }
            .bill-sub { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 2px; }
            .status-chip { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 800; text-transform: uppercase; margin-top: 8px; }
            .status-green { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
            .status-red { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
            .status-blue { background: #dbeafe; color: #1d4ed8; border: 1px solid #93c5fd; }
            .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 18px; }
            .meta-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .meta-row:last-child { margin-bottom: 0; }
            .lbl { color: #64748b; font-weight: 600; }
            .val { font-weight: 700; color: #0f172a; }
            .table-head { font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            .item-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
            .item-left { display: flex; flex-direction: column; gap: 2px; flex: 1; }
            .item-title { font-weight: 700; color: #0f172a; font-size: 13.5px; }
            .item-meta { font-size: 11px; color: #64748b; }
            .item-tag-refund { color: #dc2626; font-weight: 700; font-size: 11px; }
            .item-tag-sub { color: #15803d; font-weight: 700; font-size: 11px; }
            .item-price { font-weight: 800; color: #0f172a; white-space: nowrap; margin-left: 12px; }
            .total-card { margin-top: 18px; border-top: 2px solid #0f172a; padding-top: 14px; }
            .total-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
            .grand-total { display: flex; justify-content: space-between; font-size: 17px; font-weight: 900; margin-top: 10px; border-top: 1.5px dashed #cbd5e1; padding-top: 10px; color: #0c831f; }
            .footer { text-align: center; margin-top: 28px; font-size: 11.5px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 14px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="bill-header">
            <h1 class="bill-logo">Zipit</h1>
            <div class="bill-sub">Admin Retail & Audit Invoice</div>
            <div class="status-chip ${isRefundedOrReq ? 'status-red' : order.status === 'Delivered' ? 'status-green' : 'status-blue'}">
              ${order.status}
            </div>
          </div>

          <div class="meta-card">
            <div class="meta-row"><span class="lbl">Order Ref:</span><span class="val">#${order.id.slice(0, 8).toUpperCase()}</span></div>
            <div class="meta-row"><span class="lbl">Date & Time:</span><span class="val">${orderDate}</span></div>
            <div class="meta-row"><span class="lbl">Fulfillment:</span><span class="val" style="${(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') ? 'color:#15803d; font-weight:900;' : ''}">${(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') ? '🛍️ STORE PICKUP (Ready ~1 hr)' : '🛵 HOME DELIVERY'}</span></div>
            <div class="meta-row"><span class="lbl">Customer:</span><span class="val">${order.profiles?.name || order.delivery_address?.name || 'Guest Customer'}</span></div>
            ${(order.profiles?.phone || order.delivery_address?.phone) ? `<div class="meta-row"><span class="lbl">Contact Phone:</span><span class="val">${order.profiles?.phone || order.delivery_address?.phone}</span></div>` : ''}
            <div class="meta-row"><span class="lbl">Payment Gateway:</span><span class="val">${order.payment_method || 'Cash / Online'}</span></div>
            ${order.delivery_address?.landmark ? `<div class="meta-row" style="background:#fee2e2; padding:4px 6px; border-radius:4px; margin: 4px 0;"><span class="lbl" style="color:#b91c1c; font-weight:bold;">🚩 Landmark:</span><span class="val" style="font-weight:bold; color:#b91c1c;">${order.delivery_address.landmark}</span></div>` : ''}
            ${order.delivery_address?.family_head ? `<div class="meta-row"><span class="lbl">🏠 House/Family:</span><span class="val">${order.delivery_address.family_head}</span></div>` : ''}
            ${order.delivery_address?.alt_phone ? `<div class="meta-row"><span class="lbl">Alt Contact:</span><span class="val">${order.delivery_address.alt_phone}</span></div>` : ''}
            <div class="meta-row"><span class="lbl">Shopkeeper:</span><span class="val">${order.accepted_by_shopkeeper ? `✓ ${order.accepted_by_shopkeeper}` : 'Pending Acceptance'}</span></div>
            ${(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') ? `
              <div class="meta-row"><span class="lbl">Rider / Delivery:</span><span class="val" style="color: #64748b;">N/A (Store Pickup)</span></div>
            ` : `
              <div class="meta-row"><span class="lbl">Assigned Rider:</span><span class="val">${order.accepted_by_rider ? `🛵 ${order.accepted_by_rider}` : 'Unclaimed / Pending Rider'}</span></div>
            `}
            ${(order.delivery_address?.is_pickup || order.delivery_address?.order_type === 'PICKUP') ? `
              <div class="meta-row" style="background:#dcfce7; padding:6px 8px; border-radius:6px; margin-top:6px;">
                <span class="lbl" style="color:#15803d; font-weight:bold;">Store Pickup:</span>
                <span class="val" style="color:#15803d; font-weight:bold;">${order.delivery_address.store_location || 'Zipit Store, Rauza'} (${order.delivery_address.pickup_time_estimate || 'Ready in ~1 hr'})</span>
              </div>
            ` : order.delivery_address ? `
              <div class="meta-row" style="margin-top: 6px;"><span class="lbl">Delivery Address:</span><span class="val" style="text-align: right; max-width: 260px;">${order.delivery_address.details || order.delivery_address.full_address || 'Customer Location'}</span></div>
            ` : ''}
          </div>

          <div class="table-head">Order Items & Substitutions</div>
          ${(order.items || []).map(item => `
            <div class="item-row">
              <div class="item-left">
                <span class="item-title">${item.qty}× ${item.name}</span>
                <span class="item-meta">Unit Price: ₹${item.price}</span>
                ${item.is_refund_chosen || item.status === 'REFUND_REQUESTED' || item.status === 'REFUNDED_SUBSTITUTE' ? `<span class="item-tag-refund">🚫 Customer Chose Refund</span>` : ''}
                ${item.is_substituted ? `<span class="item-tag-sub">🔄 Substituted Product</span>` : ''}
                ${item.is_unavailable && !item.is_substituted && !item.is_refund_chosen ? `<span class="item-tag-refund">Out of Stock</span>` : ''}
              </div>
              <span class="item-price">₹${(item.price * item.qty).toFixed(2)}</span>
            </div>
          `).join('')}

          <div class="total-card">
            <div class="total-row"><span class="lbl">Subtotal</span><span class="val">₹${subtotal.toFixed(2)}</span></div>
            <div class="total-row"><span class="lbl">GST & Platform Fee</span><span class="val">Included</span></div>
            <div class="grand-total">
              <span>Grand Total</span>
              <span>₹${order.total}</span>
            </div>
          </div>

          <div class="footer">
            Zipit Quick Commerce Admin Portal • Internal Store Receipt<br/>
            Printed on ${new Date().toLocaleTimeString('en-IN')}
          </div>

          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const searchParam = queryParams.get('search')?.toLowerCase() || '';
  const viewParam = queryParams.get('view');

  useEffect(() => {
    if (viewParam && data.length > 0) {
      const itemToView = data.find(i => String(i.id) === String(viewParam));
      if (itemToView) {
        openModal(itemToView);
      }
    }
  }, [viewParam, data]);

  const baseData = (initialTab === 'grid-products' && showSelectedGridOnly) ? data.filter(p => p.is_grid) : data;
  const displayedData = searchParam ? baseData.filter(item => 
    item.name?.toLowerCase().includes(searchParam) || 
    item.id?.toLowerCase().includes(searchParam) || 
    item.code?.toLowerCase().includes(searchParam)
  ) : baseData;

  const renderToggleSwitch = (checked, onToggle) => (
    <div 
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        width: '46px',
        height: '26px',
        borderRadius: '13px',
        background: checked ? '#22c55e' : 'var(--color-surface-muted, #cbd5e1)',
        border: checked ? 'none' : '1px solid var(--color-border)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        padding: '2px',
        flexShrink: 0
      }}
    >
      <div 
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transform: checked ? 'translateX(20px)' : 'translateX(0px)',
          transition: 'transform 0.2s ease'
        }}
      />
    </div>
  );


  return (
    <div className="admin-container">
      {searchParam && (
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '14px 18px', borderRadius: '12px', marginBottom: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'}}>
          <span style={{fontSize: '14.5px'}}>Showing search results matching "<strong style={{color: '#0c831f'}}>{searchParam}</strong>"</span>
          <button 
            onClick={() => navigate(location.pathname)} 
            style={{display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease'}}
          >
            <X size={15} /> Clear Search
          </button>
        </div>
      )}
      {initialTab === 'grid-products' && (() => {
        const gridCount = allProductsList.filter(item => item.is_grid).length;
        const isFull = gridCount >= 10;
        return (
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Slot counter */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: isFull ? 'rgba(239,68,68,0.08)' : 'rgba(12,131,31,0.07)',
              border: `1px solid ${isFull ? 'rgba(239,68,68,0.3)' : 'rgba(12,131,31,0.2)'}`,
              borderRadius: '20px', padding: '6px 14px'
            }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: isFull ? '#ef4444' : '#0c831f' }}>
                {gridCount} / 10
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
                {isFull ? '🔴 Showcase Full' : 'slots used'}
              </span>
            </div>
            {/* Filter button */}
            <button
              onClick={() => setShowSelectedGridOnly(!showSelectedGridOnly)}
              style={{ background: showSelectedGridOnly ? '#0c831f' : 'var(--color-surface-muted, #f1f5f9)', color: showSelectedGridOnly ? '#fff' : 'var(--color-text)', border: '1px solid var(--color-border)', padding: '8px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease' }}
            >
              {showSelectedGridOnly ? 'Show All Products' : 'Show Selected Only'}
            </button>
          </div>
        );
      })()}
      {initialTab !== 'orders' && initialTab !== 'refunds' && initialTab !== 'grid-products' && initialTab !== 'bestsellers' && (
        <div style={{marginBottom: '20px', display: 'flex', justifyContent: 'flex-end'}}>
          <button onClick={() => openModal()} className="add-btn"><Plus size={18} /> Add New</button>
        </div>
      )}
      {/* TABS REMOVED - AdminLayout handles navigation! */}

      <div className="admin-content">
        {loading ? <div className="admin-loading">Loading data...</div> : (
          <div className="admin-list">
            {displayedData.length === 0 && (
              <div className="empty-state" style={{textAlign: 'center', padding: '48px 20px', color: 'var(--color-text-light)', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)'}}>
                No {getSectionTitle().toLowerCase()} found {searchParam ? `matching "${searchParam}"` : ''}.
              </div>
            )}
            {/* PRODUCTS / GRID / BESTSELLERS */}
            {/* 1. REGULAR PRODUCTS */}
            {initialTab === 'products' && displayedData.map(p => (
              <div 
                key={p.id} 
                className="admin-list-item" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  marginBottom: '12px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '10px', overflow: 'hidden', background: 'var(--color-surface-muted, #f8fafc)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <img src={p.image_url} alt={p.name} style={{ width: '46px', height: '46px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: '700', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </h3>
                    <div className="prod-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {p.categories && (
                        <span style={{ background: 'var(--color-surface-muted, #f1f5f9)', color: 'var(--color-text-light, #64748b)', padding: '3px 10px', borderRadius: '6px', fontSize: '12.5px', fontWeight: '500', border: '1px solid var(--color-border)' }}>
                          {p.categories.name}
                        </span>
                      )}
                      <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '6px', fontSize: '12.5px', fontWeight: '700' }}>
                        ₹{p.price}
                      </span>
                      {p.amount && (
                        <span style={{ background: 'var(--color-surface-muted, #f1f5f9)', color: 'var(--color-text-light, #64748b)', padding: '3px 10px', borderRadius: '6px', fontSize: '12.5px', fontWeight: '500', border: '1px solid var(--color-border)' }}>
                          {p.amount}
                        </span>
                      )}
                      {p.is_wafer && <span style={{ background: '#fef08a', color: '#a16207', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>Wafer</span>}
                      {p.is_grid && <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>Showcase</span>}
                      {p.is_bestseller && <span style={{ background: '#ffedd5', color: '#c2410c', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>Bestseller</span>}
                      {p.stock_count !== undefined && p.stock_count !== -1 && (
                        <span style={{ background: p.stock_count > 0 ? '#e0e7ff' : '#fee2e2', color: p.stock_count > 0 ? '#3730a3' : '#991b1b', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                          Stock: {p.stock_count}
                        </span>
                      )}
                      {(p.is_out_of_stock || p.stock_count === 0) && (
                        <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="admin-item-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
                  <button 
                    onClick={() => openModal(p)} 
                    title="Edit Product"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(p.id)} 
                    title="Delete Product"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.08)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.2)', width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {/* 2. PINNACLE SHOWCASE (Screenshot 1) */}
            {initialTab === 'grid-products' && displayedData.map(p => (
              <div 
                key={p.id} 
                className="admin-list-item" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  padding: '12px 18px',
                  marginBottom: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', background: 'var(--color-surface-muted, #f8fafc)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <img src={p.image_url} alt={p.name} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {p.is_grid && (
                        <span style={{ background: 'var(--color-surface-muted, #f1f5f9)', color: 'var(--color-text-light, #64748b)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                          PINNACLE
                        </span>
                      )}
                      {p.categories && (
                        <span style={{ background: 'var(--color-surface-muted, #f1f5f9)', color: 'var(--color-text-light, #64748b)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                          STICKER: {p.categories.name.toUpperCase()}
                        </span>
                      )}
                      {p.is_bestseller && (
                        <span style={{ background: 'var(--color-surface-muted, #f1f5f9)', color: 'var(--color-text-light, #64748b)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                          BESTSELLER
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ marginLeft: '12px', flexShrink: 0 }}>
                  {renderToggleSwitch(!!p.is_grid, async () => {
                    const newVal = !p.is_grid;
                    if (newVal) {
                      const currentCount = allProductsList.filter(item => item.is_grid).length;
                      if (currentCount >= 10) {
                        showToast('Pinnacle Showcase is full! Remove a product first before adding another. (Max 10)', 'warning');
                        return; // Block — do NOT toggle or update DB
                      }
                    }
                    setData(prev => prev.map(item => item.id === p.id ? { ...item, is_grid: newVal } : item));
                    setAllProductsList(prev => prev.map(item => item.id === p.id ? { ...item, is_grid: newVal } : item));
                    await db.products.update(p.id, { ...p, is_grid: newVal });
                  })}
                </div>
              </div>
            ))}

            {/* 3. BESTSELLERS CATEGORY GRID (Screenshot 2) */}
            {initialTab === 'bestsellers' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginTop: '8px' }}>
                {categories.map(cat => {
                  const hasBestseller = allProductsList.some(p => p.category_id === cat.id && p.is_bestseller);
                  return (
                    <div 
                      key={cat.id} 
                      onClick={() => setSelectedBestsellerCategory(cat)}
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '14px',
                        padding: '18px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        position: 'relative',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        textAlign: 'center'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.07)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)'; }}
                    >
                      {hasBestseller && (
                        <div style={{ position: 'absolute', top: '10px', right: '10px', width: '22px', height: '22px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>
                          ✓
                        </div>
                      )}
                      <div style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={cat.image_url} alt={cat.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      </div>
                      <span style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--color-text)', lineHeight: '1.2' }}>
                        {cat.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* ORDERS & REFUNDS */}
            {(initialTab === 'orders' || initialTab === 'refunds') && displayedData.map(o => (
              <div key={o.id} className="admin-list-item admin-order-card" style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '18px 20px', marginBottom: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                {/* Top header row */}
                <div className="admin-order-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', borderBottom: '1px solid var(--color-border)', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: 'var(--color-text)' }}>
                      Order #{o.id.slice(0,8).toLowerCase()}
                    </h3>
                    {(o.delivery_address?.is_pickup || o.delivery_address?.order_type === 'PICKUP') ? (
                      <span style={{ 
                        background: '#dcfce7', 
                        color: '#15803d', 
                        border: '1.5px solid #86efac', 
                        padding: '3px 10px', 
                        borderRadius: '20px', 
                        fontSize: '11.5px', 
                        fontWeight: '800',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        🛍️ STORE PICKUP (Pack & Keep)
                      </span>
                    ) : (
                      <span style={{ 
                        background: '#e0f2fe', 
                        color: '#0369a1', 
                        border: '1.5px solid #bae6fd', 
                        padding: '3px 10px', 
                        borderRadius: '20px', 
                        fontSize: '11.5px', 
                        fontWeight: '800',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        🛵 HOME DELIVERY
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button 
                      onClick={() => printOrderReceipt(o)} 
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface-muted, #f1f5f9)', border: '1px solid var(--color-border)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', color: 'var(--color-text)', fontSize: '13px', fontWeight: '600' }}
                    >
                      <Printer size={15} /> Print Bill
                    </button>
                    <select className={`status-select ${o.status.toLowerCase().replace(/ /g, '-')}`} value={o.status} onChange={async (e) => {
                      const newStatus = e.target.value;
                      setData(prev => prev.map(item => item.id === o.id ? { ...item, status: newStatus } : item));
                      await supabase.from('orders').update({status: newStatus}).eq('id', o.id);
                      showToast(`Order status updated to ${newStatus}`, 'success');
                    }}>
                      {initialTab === 'refunds' ? (
                        <>
                          <option value="Refund Requested">Refund Requested</option>
                          <option value="Refunded">Refunded</option>
                          <option value="Cancellation Requested">Cancellation Requested</option>
                          <option value="Cancellation Rejected">Cancellation Rejected</option>
                          <option value="Cancelled">Cancelled</option>
                        </>
                      ) : (
                        <>
                          <option value="Payment Pending">Payment Pending</option>
                          <option value="Placed">Placed</option>
                          <option value="Preparing">Preparing</option>
                          <option value="Ready for Pickup">Ready for Pickup</option>
                          <option value="Out for Delivery">Out for Delivery</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancellation Requested">Cancellation Requested</option>
                          <option value="Cancellation Rejected">Cancellation Rejected</option>
                          <option value="Refund Requested">Refund Requested</option>
                          <option value="Refunded">Refunded</option>
                          <option value="Cancelled">Cancelled</option>
                        </>
                      )}
                    </select>

                    <button 
                      onClick={() => handleDelete(o.id)} 
                      title="Delete Order" 
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.08)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                {/* Bottom details section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ fontSize: '15px', color: 'var(--color-text-light)' }}>
                      Customer: <span style={{ color: 'var(--color-text)', fontWeight: '600' }}>
                        {o.profiles?.name || o.delivery_address?.name || 'Customer'}
                        {(o.profiles?.phone || o.delivery_address?.phone) ? ` (${o.profiles?.phone || o.delivery_address?.phone})` : ''}
                      </span>
                    </div>

                    {(o.profiles?.phone || o.delivery_address?.phone) && (
                      <a
                        href={`tel:${o.profiles?.phone || o.delivery_address?.phone}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: '#0c831f',
                          color: '#ffffff',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          textDecoration: 'none',
                          boxShadow: '0 2px 6px rgba(12, 131, 31, 0.25)'
                        }}
                      >
                        <Phone size={13} />
                        <span>Call Customer</span>
                      </a>
                    )}
                  </div>

                  {/* Delivery Location OR Store Pickup Highlight */}
                  {o.delivery_address && (
                    (o.delivery_address?.is_pickup || o.delivery_address?.order_type === 'PICKUP') ? (
                      <div style={{
                        background: '#f0fdf4',
                        border: '1.5px solid #86efac',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        margin: '6px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 800, color: '#15803d' }}>
                          <span>🛍️ CUSTOMER WILL PICK UP FROM STORE</span>
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#166534', fontWeight: 600 }}>
                          ⏰ Ready Estimate: {o.delivery_address?.pickup_time_estimate || 'Ready in ~1 hour'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#14532d' }}>
                          📍 Store Location: {o.delivery_address?.store_location || 'Zipit Hub & Store, Rauza'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 700, marginTop: '2px' }}>
                          ⚡ Pack all items and keep aside on the pickup counter. NO RIDER ASSIGNED.
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        background: 'rgba(12, 131, 31, 0.08)',
                        border: '1px solid rgba(12, 131, 31, 0.25)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        margin: '4px 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#0c831f' }}>
                          <MapPin size={15} />
                          <span>{o.delivery_address.village_area || o.delivery_address.type || 'Village Delivery Location'}</span>
                        </div>

                        {o.delivery_address.landmark && (
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>
                            🚩 Landmark: {o.delivery_address.landmark}
                          </div>
                        )}

                        {o.delivery_address.family_head && (
                          <div style={{ fontSize: '12.5px', color: 'var(--color-text)', fontWeight: 600 }}>
                            🏠 House / Family: {o.delivery_address.family_head}
                          </div>
                        )}

                        <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
                          {o.delivery_address.details || o.delivery_address.full_address}
                          {o.delivery_address.alt_phone ? ` • Alt Phone: ${o.delivery_address.alt_phone}` : ''}
                        </div>
                      </div>
                    )
                  )}

                  <div style={{ fontSize: '15px', color: 'var(--color-text-light)' }}>
                    Total: <span style={{ color: 'var(--color-text)', fontWeight: '600' }}>₹{o.total}</span>
                    <span style={{ margin: '0 8px', color: 'var(--color-border)' }}>|</span>
                    Payment: <span style={{ color: '#0c831f', fontWeight: '600' }}>{o.payment_method || 'COD / UPI'}</span>
                  </div>
                  <div style={{ fontSize: '14.5px', color: 'var(--color-text-light)', marginBottom: '4px' }}>
                    Items: <span style={{ color: 'var(--color-text)', fontWeight: '500' }}>{o.items?.length || 0} items</span>
                  </div>

                  {/* Shopkeeper & Rider Assignment Information */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    padding: '10px 12px',
                    background: 'var(--color-surface-muted, #f8fafc)',
                    border: '1px dashed var(--color-border, #e2e8f0)',
                    borderRadius: '10px',
                    margin: '4px 0 8px 0',
                    alignItems: 'center'
                  }}>
                    {/* Shopkeeper Status */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
                      <UserCheck size={15} color={o.accepted_by_shopkeeper ? '#15803d' : '#94a3b8'} />
                      <span style={{ color: 'var(--color-text-light)' }}>Shopkeeper:</span>
                      {o.accepted_by_shopkeeper ? (
                        <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', border: '1px solid #86efac' }}>
                          ✓ {o.accepted_by_shopkeeper}
                        </span>
                      ) : (
                        <span style={{ background: '#f1f5f9', color: '#64748b', fontWeight: 600, padding: '2px 8px', borderRadius: '6px' }}>
                          ⏳ Pending Acceptance
                        </span>
                      )}
                    </div>

                    <span style={{ color: 'var(--color-border)' }}>•</span>

                    {/* Rider Status */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
                      <Bike size={15} color={(o.delivery_address?.is_pickup || o.delivery_address?.order_type === 'PICKUP') ? '#94a3b8' : o.accepted_by_rider ? '#0284c7' : '#94a3b8'} />
                      <span style={{ color: 'var(--color-text-light)' }}>Rider / Delivery:</span>
                      {(o.delivery_address?.is_pickup || o.delivery_address?.order_type === 'PICKUP') ? (
                        <span style={{ background: '#f3f4f6', color: '#6b7280', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                          🚫 No Rider (Store Pickup)
                        </span>
                      ) : o.accepted_by_rider ? (
                        <span style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                          🛵 {o.accepted_by_rider}
                        </span>
                      ) : (
                        <span style={{ background: '#fef3c7', color: '#b45309', fontWeight: 600, padding: '2px 8px', borderRadius: '6px' }}>
                          ⏳ Unclaimed (Waiting for Rider)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Item Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                    {o.items?.map((item, i) => {
                      const isRefundChosen = item.is_refund_chosen || item.status === 'REFUND_REQUESTED' || item.status === 'REFUNDED_SUBSTITUTE';
                      const isSubbed = item.is_substituted;
                      const isOosOnly = item.is_unavailable && !isSubbed && !isRefundChosen;

                      return (
                        <div 
                          key={i} 
                          style={{
                            background: isSubbed 
                              ? '#dcfce7' 
                              : isRefundChosen
                              ? '#fee2e2'
                              : isOosOnly 
                              ? 'rgba(239, 68, 68, 0.15)' 
                              : 'var(--color-surface-muted, #f1f5f9)',
                            color: isSubbed 
                              ? '#15803d' 
                              : isRefundChosen
                              ? '#dc2626'
                              : isOosOnly 
                              ? '#dc2626' 
                              : 'var(--color-text)',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '600',
                            border: isSubbed ? '1px solid #86efac' : isRefundChosen ? '1px solid #fca5a5' : '1px solid var(--color-border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span style={{ textDecoration: isOosOnly ? 'line-through' : 'none' }}>
                            {item.qty}x {item.name} (₹{item.price})
                          </span>
                          {isSubbed && (
                            <span style={{ background: '#166534', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', textDecoration: 'none' }}>
                              Substituted by Customer
                            </span>
                          )}
                          {isRefundChosen && (
                            <span style={{ background: '#dc2626', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold', textDecoration: 'none' }}>
                              Customer Chose Refund
                            </span>
                          )}
                          {!isSubbed && !isRefundChosen && (o.status === 'Preparing' || o.status === 'Payment Pending') && (
                            isOosOnly ? (
                              <button 
                                onClick={() => toggleAvailability(o, i)} 
                                title="Reverse to In Stock"
                                style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: '4px', padding: '2px 7px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                              >
                                ↩ Restore In Stock
                              </button>
                            ) : (
                              <button 
                                onClick={() => toggleAvailability(o, i)} 
                                title="Mark Out of Stock"
                                style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'none' }}
                              >
                                OOS
                              </button>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            {/* USERS */}
            {initialTab === 'users' && displayedData.map(u => (
              <div key={u.id} className="admin-list-item">
                <div className="admin-item-img" style={{background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontWeight: 'bold'}}>
                  {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="admin-item-info">
                  <h3>{u.name || 'Unknown User'}</h3>
                  <div className="prod-meta">
                    {u.phone && <span className="tag-pill" style={{background: '#e0f2fe', color: '#0369a1'}}>{u.phone}</span>}
                    {u.email && <span className="tag-pill" style={{background: '#f3f4f6'}}>{u.email}</span>}
                  </div>
                </div>
                <div className="admin-item-actions">
                  <button className="edit-btn" onClick={() => setViewUser(u)} title="View User"><Eye size={16}/></button>
                  <button className="edit-btn" onClick={() => openModal(u)} title="Edit User"><Edit2 size={16}/></button>
                  <button className="delete-btn" onClick={() => handleDelete(u.id)} title="Delete User"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}

            {/* BANNERS */}
            {initialTab === 'banners' && displayedData.map(b => (
              <div key={b.id} className="admin-list-item">
                <img src={b.image_url} alt="" className="admin-item-img" style={{width: 100, borderRadius: '4px'}} />
                <div className="admin-item-info">
                  <h3>Banner #{b.id}</h3>
                  <div className="prod-meta">
                    <span className="tag-pill">Order: {b.order_index}</span>
                  </div>
                </div>
                <div className="admin-item-actions">
                  <button className="edit-btn" onClick={() => openModal(b)}><Edit2 size={16}/></button>
                  <button className="delete-btn" onClick={() => handleDelete(b.id)}><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
            
            {/* COUPONS */}
            {initialTab === 'coupons' && displayedData.map(c => (
              <div key={c.id} className="admin-list-item">
                <div className="admin-item-info">
                  <h3>{c.code}</h3>
                  <div className="prod-meta">
                    <span className="tag-pill" style={{background: '#e0f2fe', color: '#0369a1'}}>{c.discount_type}</span>
                    {c.discount_type !== 'FREE_DELIVERY' && <span className="tag-pill">Value: {c.discount_value}</span>}
                    <span className="tag-pill">Min Order: ₹{c.min_order_amount}</span>
                    <span className="tag-pill" style={{background: c.is_active ? '#dcfce7' : '#fee2e2', color: c.is_active ? '#166534' : '#991b1b'}}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="admin-item-actions">
                  <button className="edit-btn" onClick={() => openModal(c)}><Edit2 size={16}/></button>
                  <button className="delete-btn" onClick={() => handleDelete(c.id)}><Trash2 size={16}/></button>
                </div>
              </div>
            ))}

            {/* CATEGORIES */}
            {initialTab === 'categories' && displayedData.map(c => (
              <div key={c.id} className="admin-list-item">
                <img src={c.image_url} alt="" className="admin-item-img" />
                <div className="admin-item-info">
                  <h3>{c.name}</h3>
                </div>
                <div className="admin-item-actions">
                  <button className="edit-btn" onClick={() => openModal(c)}><Edit2 size={16}/></button>
                  <button className="delete-btn" onClick={() => handleDelete(c.id)}><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VIEW USER MODAL */}
      {viewUser && createPortal(
        <div className="admin-modal-overlay" onClick={() => setViewUser(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h2 style={{margin: 0}}>User Details</h2>
              <button onClick={() => setViewUser(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--color-text)'}}><X size={20}/></button>
            </div>
            <div style={{background: 'var(--color-background)', padding: '16px', borderRadius: '12px'}}>
               <p style={{margin: '0 0 12px 0'}}><strong>ID:</strong> <br/><span style={{fontSize: '13px', color: 'var(--color-text-light)'}}>{viewUser.id}</span></p>
               <p style={{margin: '0 0 12px 0'}}><strong>Name:</strong> {viewUser.name || 'N/A'}</p>
               <p style={{margin: '0 0 12px 0'}}><strong>Phone:</strong> {viewUser.phone || 'N/A'}</p>
               <p style={{margin: '0 0 12px 0'}}><strong>Email:</strong> {viewUser.email || 'N/A'}</p>
               <p style={{margin: '0 0 12px 0'}}><strong>Address:</strong> {viewUser.address || 'N/A'}</p>
               <p style={{margin: '0'}}><strong>Joined:</strong> {new Date(viewUser.created_at).toLocaleDateString()}</p>
            </div>
            <div className="admin-modal-footer" style={{marginTop: '24px'}}>
              <button className="cancel-btn" onClick={() => setViewUser(null)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ADD/EDIT MODAL */}
      {isModalOpen && createPortal(
        <div className="admin-modal-overlay" onClick={() => !isSubmitting && setIsModalOpen(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h2 style={{margin: 0}}>{editingItem ? 'Edit' : 'Add'} {getSectionTitle().replace('Manage ', '')}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--color-text)'}}><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmit}>
              {(initialTab === 'products' || initialTab === 'grid-products' || initialTab === 'bestsellers') && (
                <>
                  <div className="form-group">
                    <label>Product Name</label>
                    <input type="text" className="admin-input" value={formData.name||''} onChange={e=>setFormData({...formData, name:e.target.value})} required/>
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select className="admin-input" value={formData.category_id||''} onChange={e=>setFormData({...formData, category_id:e.target.value})} required>
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-row">
                    <div className="form-group half">
                      <label>Price (₹)</label>
                      <input type="number" className="admin-input" value={formData.price||''} onChange={e=>setFormData({...formData, price:e.target.value})} required/>
                    </div>
                    <div className="form-group half">
                      <label>Amount (e.g. 1kg)</label>
                      <input type="text" className="admin-input" value={formData.amount||''} onChange={e=>setFormData({...formData, amount:e.target.value})} required/>
                    </div>
                  </div>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '14px 0'}}>
                    <label className={`checkbox-pill ${formData.is_grid ? 'active' : ''}`}>
                      <input type="checkbox" checked={formData.is_grid||false} onChange={e=>setFormData({...formData, is_grid:e.target.checked})} style={{display:'none'}}/>
                      <span>Pinnacle Showcase</span>
                    </label>
                    <label className={`checkbox-pill ${formData.is_bestseller ? 'active' : ''}`}>
                      <input type="checkbox" checked={formData.is_bestseller||false} onChange={e=>setFormData({...formData, is_bestseller:e.target.checked})} style={{display:'none'}}/>
                      <span>Bestseller Badge</span>
                    </label>
                    <label className={`checkbox-pill ${formData.is_wafer ? 'active' : ''}`}>
                      <input type="checkbox" checked={formData.is_wafer||false} onChange={e=>setFormData({...formData, is_wafer:e.target.checked})} style={{display:'none'}}/>
                      <span>Wafer Price Tag</span>
                    </label>
                    <label className={`checkbox-pill ${formData.is_out_of_stock ? 'active-red' : ''}`}>
                      <input type="checkbox" checked={formData.is_out_of_stock||false} onChange={e=>setFormData({...formData, is_out_of_stock:e.target.checked})} style={{display:'none'}}/>
                      <span>Force Out of Stock</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Sticker (Optional)</label>
                    <input type="text" className="admin-input" placeholder="e.g. 20% OFF" value={formData.sticker||''} onChange={e=>setFormData({...formData, sticker:e.target.value})}/>
                  </div>
                  <div className="form-group">
                    <label>Inventory Stock (-1 for unlimited)</label>
                    <input type="number" className="admin-input" value={formData.stock_count ?? -1} onChange={e=>setFormData({...formData, stock_count:parseInt(e.target.value)})} required/>
                  </div>
                </>
              )}
              
              {initialTab === 'users' && (
                <>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input type="text" className="admin-input" placeholder="e.g. John Doe" value={formData.name||''} onChange={e=>setFormData({...formData, name:e.target.value})} required/>
                  </div>
                  <div className="form-row">
                    <div className="form-group half">
                      <label>Phone Number</label>
                      <input type="tel" className="admin-input" placeholder="e.g. 9876543210" value={formData.phone||''} onChange={e=>setFormData({...formData, phone:e.target.value})} />
                    </div>
                    <div className="form-group half">
                      <label>Email Address</label>
                      <input type="email" className="admin-input" placeholder="john@example.com" value={formData.email||''} onChange={e=>setFormData({...formData, email:e.target.value})} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Address</label>
                    <textarea className="admin-input" placeholder="Enter full address" value={formData.address||''} onChange={e=>setFormData({...formData, address:e.target.value})} style={{minHeight: '80px', resize: 'vertical'}} />
                  </div>
                </>
              )}

              {initialTab === 'coupons' && (
                <>
                  <div className="form-group">
                    <label>Coupon Code</label>
                    <input type="text" className="admin-input" placeholder="e.g. WELCOME50" value={formData.code||''} onChange={e=>setFormData({...formData, code:e.target.value.toUpperCase()})} style={{textTransform: 'uppercase'}} required/>
                  </div>
                  <div className="form-row">
                    <div className="form-group half">
                      <label>Discount Type</label>
                      <select className="admin-input" value={formData.discount_type||'PERCENTAGE'} onChange={e=>setFormData({...formData, discount_type:e.target.value})}>
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FLAT">Flat Amount (₹)</option>
                        <option value="FREE_DELIVERY">Free Delivery</option>
                      </select>
                    </div>
                    <div className="form-group half">
                      <label>Discount Value</label>
                      <input type="number" className="admin-input" value={formData.discount_value||''} onChange={e=>setFormData({...formData, discount_value:e.target.value})} disabled={formData.discount_type === 'FREE_DELIVERY'} required={formData.discount_type !== 'FREE_DELIVERY'}/>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Minimum Order Amount (₹)</label>
                    <input type="number" className="admin-input" value={formData.min_order_amount||0} onChange={e=>setFormData({...formData, min_order_amount:e.target.value})} required/>
                  </div>
                  <div className="form-group" style={{display:'flex', gap:8, alignItems:'center'}}>
                    <input type="checkbox" id="is_active" checked={formData.is_active ?? true} onChange={e=>setFormData({...formData, is_active:e.target.checked})}/>
                    <label htmlFor="is_active" style={{margin:0, cursor: 'pointer', fontWeight: 'bold'}}>Is Active</label>
                  </div>
                </>
              )}

              {initialTab === 'banners' && (
                <div className="form-group">
                  <label>Order Index (Sort)</label>
                  <input type="number" className="admin-input" value={formData.order_index||1} onChange={e=>setFormData({...formData, order_index:parseInt(e.target.value)})} required/>
                </div>
              )}
              
              {initialTab === 'categories' && (
                <div className="form-group">
                  <label>Category Name</label>
                  <input type="text" className="admin-input" value={formData.name||''} onChange={e=>setFormData({...formData, name:e.target.value})} required/>
                </div>
              )}

              {initialTab !== 'users' && initialTab !== 'coupons' && (
                <div className="form-group">
                  <label>Upload Image {initialTab === 'banners' && !editingItem ? '(You can select multiple)' : ''}</label>
                  <div className="file-upload-box" onClick={()=>fileInputRef.current.click()} style={{border: '2px dashed var(--color-border)', padding: '24px', textAlign: 'center', borderRadius: '12px', cursor: 'pointer', background: 'var(--color-background)'}}>
                    <Upload size={24} style={{color: 'var(--color-text-light)', marginBottom: '8px'}}/>
                    <div style={{color: 'var(--color-text-light)'}}>Click to browse files</div>
                    <input type="file" multiple={initialTab === 'banners' && !editingItem} ref={fileInputRef} onChange={handleImageChange} style={{display:'none'}} accept="image/*" />
                  </div>
                  {imageFiles.length > 0 ? (
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px'}}>
                      {imageFiles.map((file, idx) => (
                        <div key={idx} style={{position: 'relative', width: '70px', height: '70px', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', background: '#f9f9f9'}}>
                          <img src={URL.createObjectURL(file)} alt="preview" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                          <button type="button" onClick={(e) => {
                            e.stopPropagation();
                            const newFiles = imageFiles.filter((_, i) => i !== idx);
                            setImageFiles(newFiles);
                            if (newFiles.length === 0) setImageFile(null);
                            else setImageFile(newFiles[0]);
                          }} style={{position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0}}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : imageFile ? (
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px'}}>
                      <div style={{position: 'relative', width: '70px', height: '70px', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', background: '#f9f9f9'}}>
                        <img src={URL.createObjectURL(imageFile)} alt="preview" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                        <button type="button" onClick={(e) => {
                          e.stopPropagation();
                          setImageFile(null);
                        }} style={{position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0}}>
                          <X size={12} />
                        </button>
                      </div>
                      <span style={{fontSize: '13px'}}>{imageFile.name}</span>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="admin-modal-footer" style={{marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)} style={{padding: '10px 16px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer'}}>Cancel</button>
                <button type="submit" className="submit-btn" disabled={isSubmitting} style={{padding: '10px 24px', border: 'none', borderRadius: '8px', background: '#0c831f', color: 'white', fontWeight: 'bold', cursor: 'pointer'}}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* BESTSELLERS MANAGE CATEGORY MODAL (Screenshot 3) */}
      {selectedBestsellerCategory && createPortal(
        <div className="admin-modal-overlay" style={{ zIndex: 1000 }} onClick={() => setSelectedBestsellerCategory(null)}>
          <div 
            className="admin-modal" 
            style={{ maxWidth: '600px', width: '95%', padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh', background: 'var(--color-surface)', borderRadius: '16px' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--color-text)' }}>
                Manage {selectedBestsellerCategory.name}
              </h3>
              <button 
                onClick={() => setSelectedBestsellerCategory(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px' }}
              >
                ✕
              </button>
            </div>

            {/* List of Products in Category */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {allProductsList.filter(p => p.category_id === selectedBestsellerCategory.id).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-light)' }}>
                  No products found in this category.
                </div>
              ) : (
                allProductsList.filter(p => p.category_id === selectedBestsellerCategory.id).map(p => (
                  <div 
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', background: 'var(--color-surface-muted, #f8fafc)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <img src={p.image_url} alt={p.name} style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </span>
                        {p.is_bestseller && (
                          <div>
                            <span style={{ background: 'var(--color-surface-muted, #f1f5f9)', color: 'var(--color-text-light, #64748b)', padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700' }}>
                              BESTSELLER
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ marginLeft: '12px', flexShrink: 0 }}>
                      {renderToggleSwitch(!!p.is_bestseller, async () => {
                        const newVal = !p.is_bestseller;
                        setAllProductsList(prev => prev.map(item => item.id === p.id ? { ...item, is_bestseller: newVal } : item));
                        setData(prev => prev.map(item => item.id === p.id ? { ...item, is_bestseller: newVal } : item));
                        await db.products.update(p.id, { ...p, is_bestseller: newVal });
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
export default AdminDashboard;
