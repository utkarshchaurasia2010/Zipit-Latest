import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, Grid, Heart } from 'lucide-react';
import { db, supabase } from '../services/db';
import { getProductDeliveryTime } from '../utils/time';
import { useWishlist } from '../context/WishlistContext';
import './ProductListPage.css';

const AllProductsPage = ({ navigate, cart, updateCartQty, onSearchClick, onProductClick }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const { isInWishlist, toggleWishlist } = useWishlist();

  useEffect(() => {
    const fetchData = async (silent = false) => {
      if (!silent) setLoading(true);
      const [prods, cats] = await Promise.all([
        db.products.getAll(),
        db.categories.getAll()
      ]);
      setProducts(prods);
      setCategories(cats);
      if (!silent) setLoading(false);
    };

    fetchData(false);

    const channel = supabase.channel('realtime:all_products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        fetchData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getQty = (id) => {
    const item = cart.find(c => c.id === id);
    return item ? item.qty : 0;
  };

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category_id === selectedCategory);

  return (
    <div className="product-list-page" style={{ overflowY: 'hidden', paddingBottom: 0 }}>
      <header className="page-header" style={{ flexShrink: 0 }}>
        <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <button className="back-btn" onClick={() => navigate('/')}><ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} /></button>
          <h3 style={{margin: 0, fontSize: 16}}>All Products</h3>
        </div>
        <button className="back-btn" onClick={onSearchClick}>
          <Search size={22} color="var(--color-text)" />
        </button>
      </header>
      
      <div className="all-products-layout">
        <div className="sidebar-categories" style={{ paddingBottom: '140px' }}>
          <div 
            className={`sidebar-category-item ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            <div className="icon-placeholder">
              <Grid size={20} color={selectedCategory === 'all' ? 'var(--color-success)' : 'var(--color-text-light)'} />
            </div>
            <span>All</span>
          </div>
          {categories.map(cat => (
            <div 
              key={cat.id} 
              className={`sidebar-category-item ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <img src={cat.image_url} alt={cat.name} />
              <span>{cat.name}</span>
            </div>
          ))}
        </div>
        
        <div className="all-products-main" style={{ paddingBottom: '140px' }}>
          {loading ? (
            <div style={{textAlign: 'center', padding: 40}}>Loading products...</div>
          ) : filteredProducts.length === 0 ? (
            <div style={{textAlign: 'center', padding: 40, color: '#666'}}>No products found.</div>
          ) : (
            <div className="all-products-grid">
              {filteredProducts.map(item => {
                const qty = getQty(item.id);
                return (
                  <div key={item.id} className="bestseller-card stagger-item" onClick={() => onProductClick && onProductClick(item)}>
                    <div className="bestseller-img-wrapper">
                      <div className="wishlist-btn-corner" onClick={(e) => { e.stopPropagation(); toggleWishlist(item.id); }}>
                        <Heart size={16} fill={isInWishlist(item.id) ? '#e91e63' : 'transparent'} color={isInWishlist(item.id) ? '#e91e63' : 'var(--color-text-light)'} />
                      </div>
                      <div className="bestseller-img" style={{cursor: 'default'}}>
                        {item.is_out_of_stock || item.stock_count === 0 ? (
                          <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(240, 68, 56, 0.9)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', zIndex: 10, whiteSpace: 'nowrap'}}>OUT OF STOCK</div>
                        ) : item.sticker ? (
                          <div className="wafer-sticker">{item.sticker}</div>
                        ) : null}
                        <img src={item.image_url} alt={item.name} style={{opacity: (item.is_out_of_stock || item.stock_count === 0) ? 0.4 : 1}} />
                      </div>
                      <div className="img-footer-row" onClick={(e) => e.stopPropagation()}>
                        <span className="item-amount-text">{item.amount}</span>
                        {item.is_out_of_stock || item.stock_count === 0 ? (
                          <button className="add-btn-small" style={{background: '#f2f4f7', color: '#98a2b3', border: '1px solid #e4e7ec'}} onClick={(e) => { e.stopPropagation(); updateCartQty(item, 1); }}>ADD</button>
                        ) : qty === 0 ? (
                          <button className="add-btn-small" onClick={(e) => { e.stopPropagation(); updateCartQty(item, 1); }}>ADD</button>
                        ) : (
                          <div className="qty-control" onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => { e.stopPropagation(); updateCartQty(item, -1); }}>-</button>
                            <span>{qty}</span>
                            <button onClick={(e) => { e.stopPropagation(); updateCartQty(item, 1); }}>+</button>
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
        </div>
      </div>
    </div>
  );
};
export default AllProductsPage;
