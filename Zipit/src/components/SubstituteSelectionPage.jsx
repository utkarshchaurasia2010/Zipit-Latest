import React, { useState, useEffect } from 'react';
import { ChevronLeft, Check, Plus, RefreshCw, Ban, ShoppingBag, ArrowRight } from 'lucide-react';
import { db, supabase } from '../services/db';
import { PageSkeleton } from './SkeletonLoader';
import './SubstituteSelectionPage.css';

const SubstituteSelectionPage = ({ navigate }) => {
  const [activeOrder, setActiveOrder] = useState(null);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedSubstitutes, setSelectedSubstitutes] = useState({});
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const orders = await db.orders.getAll();
        const pendingOrder = (orders || []).find(o => o.substitution_status === 'PENDING_CUSTOMER_ACTION');
        setActiveOrder(pendingOrder || null);

        const prods = await db.products.getAll();
        const cats = await db.categories.getAll();
        setAvailableProducts(prods || []);
        setAvailableCategories(cats || []);

        if (pendingOrder && pendingOrder.items) {
          const initialChoices = {};
          pendingOrder.items.forEach((item, index) => {
            if (item.is_unavailable) {
              initialChoices[index] = { action: 'refund' };
            }
          });
          setSelectedSubstitutes(initialChoices);
          // Default active item index to first unavailable item
          const firstOOS = pendingOrder.items.findIndex(i => i.is_unavailable);
          if (firstOOS !== -1) setActiveItemIndex(firstOOS);
        }
      } catch (err) {
        console.error('Error loading substitute page data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const [extraPaymentModal, setExtraPaymentModal] = useState(null);

  const handleConfirmSubstitutions = async (bypassExtraChargeModal = false) => {
    if (!activeOrder) return;

    // Check price differences across all replaced items
    let totalExtraCharge = 0;
    let totalRefundDue = 0;

    activeOrder.items.forEach((item, idx) => {
      if (!item.is_unavailable) return;
      const choice = selectedSubstitutes[idx];
      if (choice?.action === 'replace' && choice.replacementProduct) {
        const diff = (choice.replacementProduct.price - item.price) * item.qty;
        if (diff > 0) totalExtraCharge += diff;
        if (diff < 0) totalRefundDue += Math.abs(diff);
      } else if (choice?.action === 'refund' || !choice) {
        totalRefundDue += (item.price * item.qty);
      }
    });

    if (totalExtraCharge > 0 && !bypassExtraChargeModal) {
      setExtraPaymentModal({ amount: totalExtraCharge });
      return;
    }

    setSubmitting(true);

    try {
      const currentItems = [...activeOrder.items];
      let newTotal = activeOrder.total || 0;
      let isRefundChosenForOrder = false;

      const finalItems = currentItems.map((item, idx) => {
        if (!item.is_unavailable) return item;
        const choice = selectedSubstitutes[idx];

        if (!choice || choice.action === 'refund') {
          isRefundChosenForOrder = true;
          return {
            ...item,
            status: 'REFUND_REQUESTED',
            is_refund_chosen: true,
            is_unavailable: true
          };
        } else if (choice.action === 'replace' && choice.replacementProduct) {
          const priceDiff = (choice.replacementProduct.price - item.price) * item.qty;
          newTotal += priceDiff;
          return {
            id: choice.replacementProduct.id,
            name: `${choice.replacementProduct.name} (Substituted for ${item.name})`,
            original_item_name: item.name,
            original_item_price: item.price,
            price: choice.replacementProduct.price,
            qty: item.qty,
            image_url: choice.replacementProduct.image_url,
            is_substituted: true,
            is_unavailable: false
          };
        }
        return item;
      });

      const updatePayload = {
        items: finalItems,
        total: Math.round(newTotal),
        substitution_status: totalRefundDue > 0 ? 'REFUND_PENDING' : 'RESOLVED'
      };

      if (totalRefundDue > 0 || isRefundChosenForOrder) {
        updatePayload.refund_amount = (activeOrder.refund_amount || 0) + totalRefundDue;
        updatePayload.refund_reason = `Substitution refund report: ₹${totalRefundDue} to be refunded to customer.`;
        updatePayload.status = 'Refund Initiated';
      }

      if (totalExtraCharge > 0) {
        updatePayload.extra_charges = totalExtraCharge;
      }

      await supabase.from('orders').update(updatePayload).eq('id', activeOrder.id);

      navigate('/track', { replace: true });
    } catch (err) {
      console.error('Failed to update substitutions:', err);
    } finally {
      setSubmitting(false);
      setExtraPaymentModal(null);
    }
  };

  if (loading) {
    return <PageSkeleton type="list" />;
  }

  if (!activeOrder) {
    return (
      <div className="substitute-page">
        <header className="substitute-page-header">
          <button className="back-btn" onClick={() => navigate('/track', { replace: true })}>
            <ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} />
          </button>
          <h2>Substitute Selection</h2>
        </header>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-light)' }}>
          <p>No active items require substitution right now.</p>
          <button className="substitute-confirm-bar-btn" style={{ maxWidth: '240px', margin: '20px auto 0' }} onClick={() => navigate('/track', { replace: true })}>
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const currentItem = activeOrder.items[activeItemIndex];
  const unavailableItemsCount = activeOrder.items.filter(i => i.is_unavailable).length;

  return (
    <div className="substitute-page">
      {/* Top Header */}
      <header className="substitute-page-header">
        <button className="back-btn" onClick={() => navigate('/track', { replace: true })}>
          <ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} />
        </button>
        <div>
          <h2>Select Replacement</h2>
          <p className="substitute-header-sub">Order #{activeOrder.id.slice(0, 8).toUpperCase()} • {unavailableItemsCount} item(s) out of stock</p>
        </div>
      </header>

      {/* Out of Stock Item Tabs Selector */}
      {unavailableItemsCount > 1 && (
        <div className="substitute-item-tabs">
          {activeOrder.items.map((item, idx) => {
            if (!item.is_unavailable) return null;
            return (
              <button
                key={idx}
                className={`substitute-item-tab ${activeItemIndex === idx ? 'active' : ''}`}
                onClick={() => setActiveItemIndex(idx)}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Out of Stock Banner Info */}
      {currentItem && (
        <div className="substitute-out-banner">
          <div className="substitute-out-left">
            <span className="substitute-out-tag">OUT OF STOCK</span>
            <h3 className="substitute-out-title">{currentItem.name}</h3>
            <span className="substitute-out-meta">₹{currentItem.price} • Qty: {currentItem.qty}</span>
          </div>
          {selectedSubstitutes[activeItemIndex]?.action === 'replace' && selectedSubstitutes[activeItemIndex]?.replacementProduct && (
            <div className="substitute-chosen-chip">
              Selected: <strong>{selectedSubstitutes[activeItemIndex].replacementProduct.name}</strong>
            </div>
          )}
        </div>
      )}

      {/* Category Filter Pills (Rounded Edge Rectangular Buttons) */}
      <div className="substitute-categories-bar">
        <button
          className={`substitute-cat-pill ${selectedCategoryFilter === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategoryFilter('all')}
        >
          All Items
        </button>
        {availableCategories.map(cat => (
          <button
            key={cat.id}
            className={`substitute-cat-pill ${selectedCategoryFilter === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedCategoryFilter(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product Catalog Grid */}
      <div className="substitute-products-grid">
        {availableProducts
          .filter(p => {
            // Category filter
            const matchesCategory = selectedCategoryFilter === 'all' || p.category_id === selectedCategoryFilter;
            // Exclude out of stock items
            const isAvailableInStock = !p.is_out_of_stock && (p.stock_count === undefined || p.stock_count === null || p.stock_count > 0 || p.stock_count === -1);
            // Exclude the exact product currently being substituted
            const isNotOriginalItem = currentItem ? (p.name !== currentItem.name && p.id !== currentItem.id) : true;
            
            return matchesCategory && isAvailableInStock && isNotOriginalItem;
          })
          .map(prod => {
            const isChosen = selectedSubstitutes[activeItemIndex]?.action === 'replace' && selectedSubstitutes[activeItemIndex]?.replacementProduct?.id === prod.id;
            const priceDiff = currentItem ? prod.price - currentItem.price : 0;

            return (
              <div
                key={prod.id}
                className={`substitute-prod-card ${isChosen ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedSubstitutes(prev => ({
                    ...prev,
                    [activeItemIndex]: { action: 'replace', replacementProduct: prod }
                  }));
                }}
              >
                <div className="substitute-prod-img-wrapper">
                  <img src={prod.image_url} alt={prod.name} />
                  {isChosen && (
                    <div className="substitute-chosen-badge">
                      <Check size={14} color="#fff" strokeWidth={3} />
                    </div>
                  )}
                </div>

                <div className="substitute-prod-info">
                  <h4 className="substitute-prod-title">{prod.name}</h4>
                  <div className="substitute-prod-price-row">
                    <span className="substitute-prod-price">₹{prod.price}</span>
                    {priceDiff !== 0 && (
                      <span className={`substitute-diff-tag ${priceDiff > 0 ? 'diff-higher' : 'diff-lower'}`}>
                        {priceDiff > 0 ? `+₹${priceDiff}` : `-₹${Math.abs(priceDiff)}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* ADD Button */}
                <button
                  className={`substitute-add-btn ${isChosen ? 'added' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSubstitutes(prev => ({
                      ...prev,
                      [activeItemIndex]: { action: 'replace', replacementProduct: prod }
                    }));
                  }}
                >
                  {isChosen ? (
                    <>
                      <Check size={14} /> ADDED
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> ADD
                    </>
                  )}
                </button>
              </div>
            );
          })}
      </div>

      {/* Fixed Bottom-of-Screen Dual Action Bar */}
      <div className="substitute-bottom-bar">
        <button
          className={`substitute-bottom-btn refund-btn ${selectedSubstitutes[activeItemIndex]?.action === 'refund' ? 'active' : ''}`}
          onClick={() => {
            setSelectedSubstitutes(prev => ({ ...prev, [activeItemIndex]: { action: 'refund' } }));
            handleConfirmSubstitutions();
          }}
          disabled={submitting}
        >
          <Ban size={16} /> Refund ₹{(currentItem?.price || 0) * (currentItem?.qty || 1)}
        </button>

        <button
          className={`substitute-bottom-btn replace-btn ${selectedSubstitutes[activeItemIndex]?.action === 'replace' && selectedSubstitutes[activeItemIndex]?.replacementProduct ? 'active' : 'inactive'}`}
          onClick={() => handleConfirmSubstitutions(false)}
          disabled={submitting || !(selectedSubstitutes[activeItemIndex]?.action === 'replace' && selectedSubstitutes[activeItemIndex]?.replacementProduct)}
        >
          <RefreshCw size={16} /> Substitute Product
        </button>
      </div>

      {/* Extra Charges Confirmation Modal */}
      {extraPaymentModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--color-surface, #ffffff)',
            borderRadius: '20px',
            padding: '24px 20px',
            maxWidth: '360px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              background: '#fef3c7',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#d97706'
            }}>
              <RefreshCw size={26} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 8px' }}>
              Extra Charges Required
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--color-text-light)', lineHeight: '1.5', margin: '0 0 18px' }}>
              The selected substitute product costs <strong style={{ color: '#0c831f' }}>₹{extraPaymentModal.amount} more</strong> than the original item. Would you like to proceed and pay the difference?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => handleConfirmSubstitutions(true)}
                disabled={submitting}
                style={{
                  background: 'linear-gradient(135deg, #0c831f 0%, #065f15 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(12, 131, 31, 0.3)'
                }}
              >
                Pay Extra ₹{extraPaymentModal.amount} & Confirm
              </button>

              <button
                onClick={() => setExtraPaymentModal(null)}
                disabled={submitting}
                style={{
                  background: 'var(--color-surface-muted, #f1f5f9)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  padding: '11px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Choose Another Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubstituteSelectionPage;
