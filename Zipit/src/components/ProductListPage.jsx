import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, Heart, Filter, X, SlidersHorizontal } from 'lucide-react';
import { db, supabase } from '../services/db';
import { getProductDeliveryTime } from '../utils/time';
import { useWishlist } from '../context/WishlistContext';
import './ProductListPage.css';
import './SkeletonLoader.css';

const ProductListPage = ({ category: initialCategory, categoryId, navigate, cart, updateCartQty, from, onSearchClick, onProductClick }) => {
  const [products, setProducts] = useState([]);
  const [categoryName, setCategoryName] = useState(initialCategory);
  const [loading, setLoading] = useState(true);
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterConfig, setFilterConfig] = useState({ inStockOnly: false, sort: 'default' });

  const getFilteredProducts = () => {
    let result = [...products];
    if (filterConfig.inStockOnly) {
      result = result.filter(p => !p.is_out_of_stock);
    }
    if (filterConfig.sort === 'price_asc') result.sort((a, b) => a.price - b.price);
    if (filterConfig.sort === 'price_desc') result.sort((a, b) => b.price - a.price);
    return result;
  };

  const filteredProducts = getFilteredProducts();

  useEffect(() => {
    const fetchProducts = async (silent = false) => {
      if (!silent) setLoading(true);
      if (categoryId === 'budget-49') {
        const all = await db.products.getAll();
        setProducts(all.filter(p => p.price <= 49 && !p.is_out_of_stock));
        setCategoryName('Under ₹49 Store');
      } else if (categoryId === 'budget-99') {
        const all = await db.products.getAll();
        setProducts(all.filter(p => p.price > 49 && p.price <= 99 && !p.is_out_of_stock));
        setCategoryName('Under ₹99 Store');
      } else if (categoryId) {
        const data = await db.products.getByCategory(categoryId);
        setProducts(data);
        const cats = await db.categories.getAll();
        const matched = cats.find(c => c.id === categoryId);
        if (matched) setCategoryName(matched.name);
      } else if (initialCategory) {
        const data = await db.products.getByCategoryName(initialCategory);
        setProducts(data);
        setCategoryName(initialCategory);
      } else {
        const data = await db.products.getAll();
        setProducts(data);
        setCategoryName('All Products');
      }
      if (!silent) setLoading(false);
    };

    fetchProducts(false);

    const channel = supabase.channel(`realtime:product_list_${categoryId || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [categoryId]);

  const getQty = (id) => {
    const item = cart.find(c => c.id === id);
    return item ? item.qty : 0;
  };

  return (
    <div className="product-list-page">
      <header className="page-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <button className="back-btn" onClick={() => navigate(-1)}><ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} /></button>
          <h3 style={{margin: 0, fontSize: 16}}>{categoryName}</h3>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          <button className="back-btn" onClick={() => setIsFilterOpen(true)}>
            <Filter size={20} color="var(--color-text)" />
          </button>
          <button className="back-btn" onClick={onSearchClick}>
            <Search size={22} color="var(--color-text)" />
          </button>
        </div>
      </header>
      
      {loading ? (
        <div className="product-list-grid" style={{ padding: '16px 0' }}>
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="bestseller-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', border: 'none', boxShadow: 'none' }}>
              <div className="skeleton-box" style={{ width: '100%', aspectRatio: '1', borderRadius: '12px' }}></div>
              <div className="skeleton-box" style={{ width: '80%', height: '12px', borderRadius: '4px', marginTop: '4px' }}></div>
              <div className="skeleton-box" style={{ width: '40%', height: '12px', borderRadius: '4px' }}></div>
              <div className="skeleton-box" style={{ width: '100%', height: '32px', borderRadius: '8px', marginTop: '8px' }}></div>
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{textAlign: 'center', padding: 40, color: '#666'}}>No products found matching filters.</div>
      ) : (
        <div className="product-list-grid">
          {filteredProducts.map(item => {
            const qty = getQty(item.id);
            return (
              <div key={item.id} className="bestseller-card stagger-item" onClick={() => onProductClick && onProductClick(item)}>
                <div className="bestseller-img-wrapper">
                  <div className="wishlist-btn-corner" onClick={(e) => { e.stopPropagation(); toggleWishlist(item.id); }}>
                    <Heart size={16} fill={isInWishlist(item.id) ? '#e91e63' : 'transparent'} color={isInWishlist(item.id) ? '#e91e63' : 'var(--color-text-light)'} />
                  </div>
                  <div className="bestseller-img">
                    {item.is_out_of_stock || item.stock_count === 0 ? (
                      <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(240, 68, 56, 0.9)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', zIndex: 10, whiteSpace: 'nowrap'}}>OUT OF STOCK</div>
                    ) : item.sticker ? (
                      <div className="wafer-sticker">{item.sticker}</div>
                    ) : null}
                    <img 
                      src={item.image_url} 
                      alt={item.name} 
                      loading="lazy" 
                      decoding="async" 
                      style={{opacity: (item.is_out_of_stock || item.stock_count === 0) ? 0.4 : 1}} 
                    />
                  </div>
                  <div className="img-footer-row" onClick={(e) => e.stopPropagation()}>
                    <span className="item-amount-text">{item.amount}</span>
                    {item.is_out_of_stock || item.stock_count === 0 ? (
                      <button className="add-btn-small" style={{background: '#f2f4f7', color: '#98a2b3', border: '1px solid #e4e7ec'}} disabled>ADD</button>
                    ) : qty === 0 ? (
                      <button className="add-btn-small" onClick={() => updateCartQty(item, 1)}>ADD</button>
                    ) : (
                      <div className="qty-control">
                        <button onClick={() => updateCartQty(item, -1)}>-</button>
                        <span>{qty}</span>
                        <button onClick={() => updateCartQty(item, 1)}>+</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bestseller-info">
                  <div className="item-price">
                    {item.is_wafer ? (
                      <span className="wafer-price-tag">₹{item.price}</span>
                    ) : (
                      <>₹{item.price}</>
                    )}
                  </div>
                  <h3 className="item-name">{item.name}</h3>
                  {item.stock_count > 0 && item.stock_count <= 2 ? (
                    <div style={{color: '#d92d20', fontSize: '10px', fontWeight: 'bold', marginTop: '2px'}}>{item.stock_count} left!</div>
                  ) : item.stock_count > 2 && item.stock_count < 10 ? (
                    <div style={{color: '#f79009', fontSize: '10px', fontWeight: 'bold', marginTop: '2px'}}>Only few left</div>
                  ) : null}
                  <div className="time-tag">⏱ {getProductDeliveryTime(item.name)} MINS</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {isFilterOpen && (
        <div 
          className="filter-drawer-overlay" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.55)', 
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 10000, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'flex-end',
            alignItems: 'center'
          }} 
          onClick={() => setIsFilterOpen(false)}
        >
          <div 
            className="filter-drawer" 
            style={{ 
              background: 'var(--color-surface, #ffffff)', 
              borderTopLeftRadius: '24px', 
              borderTopRightRadius: '24px', 
              width: '100%',
              maxWidth: '540px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.2)',
              border: '1px solid var(--color-border)',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'hidden'
            }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Drag Handle & Header */}
            <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SlidersHorizontal size={17} color="#10B981" />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--color-text)' }}>Filters & Sort</h3>
              </div>
              <button 
                onClick={() => setIsFilterOpen(false)} 
                aria-label="Close filters"
                style={{ background: 'var(--color-surface-muted)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text)' }}
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Scrollable Filter Content */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, overscrollBehavior: 'contain' }}>
              {/* Availability Filter */}
              <div style={{ marginBottom: '22px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Availability
                </h4>
                <div
                  onClick={() => setFilterConfig({...filterConfig, inStockOnly: !filterConfig.inStockOnly})}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '16px',
                    background: filterConfig.inStockOnly ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-surface-muted)',
                    color: filterConfig.inStockOnly ? '#10B981' : 'var(--color-text)',
                    fontWeight: filterConfig.inStockOnly ? '700' : '600',
                    border: `1.5px solid ${filterConfig.inStockOnly ? '#10B981' : 'var(--color-border)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                    boxShadow: filterConfig.inStockOnly ? '0 2px 8px rgba(16, 185, 129, 0.15)' : 'none'
                  }}
                >
                  <span style={{ fontSize: '14px' }}>In Stock Only</span>
                  <div style={{
                    width: '44px', 
                    height: '24px', 
                    borderRadius: '12px',
                    background: filterConfig.inStockOnly ? '#10B981' : 'var(--color-border)',
                    position: 'relative', 
                    transition: 'all 0.25s cubic-bezier(0.4, 0.0, 0.2, 1)'
                  }}>
                    <div style={{
                      width: '18px', 
                      height: '18px', 
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      position: 'absolute', 
                      top: '3px',
                      left: filterConfig.inStockOnly ? '23px' : '3px',
                      transition: 'all 0.25s cubic-bezier(0.4, 0.0, 0.2, 1)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.25)'
                    }} />
                  </div>
                </div>
              </div>

              {/* Sort By Filter */}
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Sort By
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { id: 'default', label: 'Relevance' },
                    { id: 'price_asc', label: 'Price: Low to High' },
                    { id: 'price_desc', label: 'Price: High to Low' }
                  ].map(sortOption => (
                    <div
                      key={sortOption.id}
                      onClick={() => setFilterConfig({...filterConfig, sort: sortOption.id})}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '14px',
                        background: filterConfig.sort === sortOption.id ? 'var(--color-text)' : 'var(--color-surface-muted)',
                        color: filterConfig.sort === sortOption.id ? 'var(--color-background)' : 'var(--color-text)',
                        fontWeight: filterConfig.sort === sortOption.id ? '700' : '500',
                        border: `1px solid ${filterConfig.sort === sortOption.id ? 'transparent' : 'var(--color-border)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '13.5px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>{sortOption.label}</span>
                      {filterConfig.sort === sortOption.id && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-background)' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer with Apply Button */}
            <div style={{ padding: '14px 20px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0, background: 'var(--color-surface)' }}>
              <button 
                onClick={() => setIsFilterOpen(false)} 
                style={{ 
                  width: '100%', 
                  padding: '14px', 
                  background: 'var(--color-primary, #0c831f)', 
                  color: '#ffffff', 
                  border: 'none', 
                  borderRadius: '16px', 
                  fontWeight: '800', 
                  fontSize: '15px', 
                  cursor: 'pointer', 
                  boxShadow: '0 4px 14px rgba(12, 131, 31, 0.3)' 
                }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ProductListPage;
