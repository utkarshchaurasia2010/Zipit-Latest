import React, { useState, useEffect } from 'react';
import { ChevronLeft, Heart, ShoppingBag } from 'lucide-react';
import { db } from '../services/db';
import { useWishlist } from '../context/WishlistContext';
import { getProductDeliveryTime } from '../utils/time';
import './WishlistPage.css';

const WishlistPage = ({ navigate, cart, updateCartQty }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { wishlistIds, isInWishlist, toggleWishlist, loading: wishlistLoading } = useWishlist();

  useEffect(() => {
    const fetchWishlistProducts = async () => {
      const all = await db.products.getAll();
      const wishlistProducts = all.filter(p => wishlistIds.includes(p.id));
      setProducts(wishlistProducts);
      setLoading(false);
    };
    if (!wishlistLoading) {
      fetchWishlistProducts();
    }
  }, [wishlistIds, wishlistLoading]);

  const getQty = (id) => {
    const item = cart.find(c => c.id === id);
    return item ? item.qty : 0;
  };

  if (loading || wishlistLoading) {
    return <div className="wishlist-page"><div className="loading-state">Loading your favorites...</div></div>;
  }

  return (
    <div className="wishlist-page">
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', padding: '8px 16px' }}>
        <button className="back-btn" onClick={() => navigate(-1)} style={{ padding: '8px', margin: 0 }}>
          <ChevronLeft size={26} color="var(--color-text)" strokeWidth={2.6} />
        </button>
        <h2 style={{ fontSize: '18px', margin: 0 }}>My Wishlist</h2>
      </header>

      {products.length === 0 ? (
        <div className="empty-wishlist">
          <Heart size={48} color="var(--color-text-light)" style={{opacity: 0.3}} />
          <h3>No favorites yet</h3>
          <p>Tap the heart icon on products to save them here for later.</p>
          <button className="browse-btn" onClick={() => navigate('/')}>Browse Products</button>
        </div>
      ) : (
        <div className="wishlist-grid">
          {products.map(item => {
            const qty = getQty(item.id);
            return (
              <div key={item.id} className="bestseller-card stagger-item">
                <div className="bestseller-img-wrapper">
                  <div className="wishlist-btn-corner" onClick={(e) => { e.stopPropagation(); toggleWishlist(item.id); }}>
                    <Heart size={16} fill={isInWishlist(item.id) ? '#e91e63' : 'transparent'} color={isInWishlist(item.id) ? '#e91e63' : 'var(--color-text-light)'} />
                  </div>
                  <div className="bestseller-img">
                    {item.sticker && <div className="wafer-sticker">{item.sticker}</div>}
                    <img src={item.image_url} alt={item.name} />
                  </div>
                  <div className="img-footer-row" onClick={e => e.stopPropagation()}>
                    <span className="item-amount-text">{item.amount}</span>
                    {qty === 0 ? (
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
                  <div className="time-tag">⏱ {getProductDeliveryTime(item.name)} MINS</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
