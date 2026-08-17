import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Info, Flame, Dumbbell, Wheat, Droplet } from 'lucide-react';
import { getProductDeliveryTime } from '../utils/time';
import { getNutritionalInfo } from '../utils/nutrition';
import './ProductDetailsSheet.css';
import { db } from '../services/db';

const ProductDetailsSheet = ({ product, onClose, cart, updateCartQty }) => {
  const [suggested, setSuggested] = useState([]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const fetchSuggested = async () => {
      const all = await db.products.getAll();
      const filtered = all.filter(p => p.id !== product.id);
      setSuggested(filtered.sort(() => 0.5 - Math.random()).slice(0, 4));
    };
    fetchSuggested();
  }, [product]);

  const qty = cart.find(c => c.id === product.id)?.qty || 0;
  
  // Use database nutrition_info if available, otherwise fallback to the fuzzy-matching dictionary
  let nutrition = getNutritionalInfo(product.name);
  if (product.nutrition_info) {
    try {
      nutrition = typeof product.nutrition_info === 'string' ? JSON.parse(product.nutrition_info) : product.nutrition_info;
    } catch (e) {
      console.error("Error parsing nutrition_info", e);
    }
  }

  return createPortal(
    <div className="product-details-overlay" onClick={onClose}>
      <div className="product-details-sheet" onClick={e => e.stopPropagation()}>
        <button className="details-close-btn" onClick={onClose}><X size={20} /></button>
        
        <div className="details-image-container">
          {product.sticker && <div className="wafer-sticker" style={{top: 16, left: 16, fontSize: '10px', padding: '4px 8px'}}>{product.sticker}</div>}
          <img src={product.image_url} alt={product.name} />
        </div>
        
        <div className="details-content">
          <h2 className="details-title">{product.name}</h2>
          
          <div className="details-delivery-tag" style={{marginBottom: '12px'}}>
            <Clock size={14} /> Delivery in {getProductDeliveryTime(product.name)} mins
          </div>

          {product.is_out_of_stock || product.stock_count === 0 ? (
            <div style={{background: 'rgba(240, 68, 56, 0.1)', color: '#d92d20', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', width: 'max-content'}}>
              <Info size={16} /> OUT OF STOCK
            </div>
          ) : product.stock_count > 0 && product.stock_count <= 2 ? (
            <div style={{background: 'rgba(240, 68, 56, 0.1)', color: '#d92d20', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', width: 'max-content'}}>
              <Info size={16} /> {product.stock_count} left!
            </div>
          ) : product.stock_count > 2 && product.stock_count < 10 ? (
            <div style={{background: 'rgba(247, 144, 9, 0.1)', color: '#b54708', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', width: 'max-content'}}>
              <Info size={16} /> Only few left
            </div>
          ) : null}

          <div className="details-info-box">
            {product.is_non_edible ? (
              <div className="nutrition-section">
                <h3>Product Specifications</h3>
                <div className="specs-grid" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                  {product.specifications ? (
                    product.specifications.split(',').map((spec, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--color-surface-muted)', borderRadius: '12px' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' }}></div>
                        <span style={{ fontSize: '14px', color: 'var(--color-text)' }}>{spec.trim()}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '12px', background: 'var(--color-surface-muted)', borderRadius: '12px', color: 'var(--color-text-light)', fontSize: '14px' }}>
                      General household / stationery product.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="nutrition-section">
                <h3>Nutritional Value</h3>
                <div className="nutrition-grid">
                  <div className="nutrition-item energy-item">
                    <Flame size={18} className="nutrition-icon" />
                    <span className="nutrition-value">{nutrition.energy || '-'}</span>
                    <span className="nutrition-label">Energy</span>
                  </div>
                  <div className="nutrition-item protein-item">
                    <Dumbbell size={18} className="nutrition-icon" />
                    <span className="nutrition-value">{nutrition.protein || '-'}</span>
                    <span className="nutrition-label">Protein</span>
                  </div>
                  <div className="nutrition-item carbs-item">
                    <Wheat size={18} className="nutrition-icon" />
                    <span className="nutrition-value">{nutrition.carbs || '-'}</span>
                    <span className="nutrition-label">Carbs</span>
                  </div>
                  <div className="nutrition-item fat-item">
                    <Droplet size={18} className="nutrition-icon" />
                    <span className="nutrition-value">{nutrition.fat || '-'}</span>
                    <span className="nutrition-label">Fat</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {suggested.length > 0 && (
            <div className="details-suggested">
              <h4>Frequently Bought Together</h4>
              <div className="suggested-carousel">
                {suggested.map(s => {
                   const sqty = cart.find(c => c.id === s.id)?.qty || 0;
                   return (
                   <div key={s.id} className="suggested-item">
                     <img src={s.image_url} alt={s.name} />
                     <span className="suggested-item-name">{s.name}</span>
                     <span className="suggested-item-price">₹{s.price}</span>
                     {sqty === 0 ? (
                       <button className="add-btn-small" style={{borderRadius: 4, padding: '4px 16px'}} onClick={() => updateCartQty(s, 1)}>ADD</button>
                     ) : (
                       <div className="qty-control" style={{width: '64px', borderRadius: 4}}>
                          <button onClick={() => updateCartQty(s, -1)}>-</button>
                          <span>{sqty}</span>
                          <button onClick={() => updateCartQty(s, 1)}>+</button>
                       </div>
                     )}
                   </div>
                   );
                })}
              </div>
            </div>
          )}
          
          <div className="details-action-bar-sticky">
            <div className="details-action-bar-left">
              <div className="details-action-price">
                {product.is_wafer ? <span className="wafer-price-tag" style={{fontSize:'14px', padding:'2px 8px'}}>₹{product.price}</span> : <>₹{product.price}</>}
              </div>
              <div className="details-action-amount">{product.amount}</div>
            </div>
            <div className="details-action-bar-right">
              {product.is_out_of_stock || product.stock_count === 0 ? (
                 <button className="details-action-add" style={{background: '#E5E0E0', color: '#991b1b', border: '1px solid #d1c8c8'}} disabled>OUT OF STOCK</button>
              ) : qty === 0 ? (
                 <button className="details-action-add" onClick={() => updateCartQty(product, 1)}>ADD</button>
              ) : (
                 <div className="details-action-qty">
                    <button onClick={() => updateCartQty(product, -1)}>-</button>
                    <span>{qty}</span>
                    <button onClick={() => {
                       if (product.stock_count > 0 && qty >= product.stock_count) {
                         alert(`Only ${product.stock_count} left in stock!`);
                       } else {
                         updateCartQty(product, 1);
                       }
                    }}>+</button>
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
export default ProductDetailsSheet;
