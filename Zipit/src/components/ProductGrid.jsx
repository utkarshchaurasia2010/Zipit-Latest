import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, X, Heart, Tag, Flame, Zap, ShieldCheck, RefreshCw, Star, Sparkles, ShoppingBag, Award } from 'lucide-react';
import { db, supabase } from '../services/db';
import { getProductDeliveryTime } from '../utils/time';
import { useWishlist } from '../context/WishlistContext';
import CategoriesPage from './CategoriesPage';
import './ProductGrid.css';
import './ProductListPage.css';

const ProductGrid = ({ navigate, cart, updateCartQty, onProductClick }) => {
  const [selectedBestsellerCategory, setSelectedBestsellerCategory] = useState(null);
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [allProducts, setAllProducts] = useState(() => {
    try {
      const cached = localStorage.getItem('zipit_cached_products');
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });

  const [gridProducts, setGridProducts] = useState(() => {
    try {
      const cached = localStorage.getItem('zipit_cached_products');
      if (cached) {
        const prods = JSON.parse(cached);
        return prods.filter(p => p.is_grid);
      }
    } catch (_) {}
    return [];
  });

  const [bestsellerProducts, setBestsellerProducts] = useState(() => {
    try {
      const cached = localStorage.getItem('zipit_cached_products');
      if (cached) {
        const prods = JSON.parse(cached);
        return prods.filter(p => p.is_bestseller);
      }
    } catch (_) {}
    return [];
  });

  useEffect(() => {
    let initialLoad = true;
    let currentOrder = [];

    const fetchProds = async () => {
      const all = await db.products.getAll();
      setAllProducts(all || []);

      const gridProds = all.filter(p => p.is_grid);
      
      if (initialLoad) {
        for (let i = gridProds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [gridProds[i], gridProds[j]] = [gridProds[j], gridProds[i]];
        }
        currentOrder = gridProds.map(p => p.id);
        initialLoad = false;
      } else {
        gridProds.sort((a, b) => {
          const indexA = currentOrder.indexOf(a.id);
          const indexB = currentOrder.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }
      
      setGridProducts(gridProds);
      setBestsellerProducts(all.filter(p => p.is_bestseller));
    };
    fetchProds();

    const channel = supabase.channel('realtime:product_grid')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProds();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const groupedBestsellers = {};
  bestsellerProducts.forEach(p => {
    const cname = p.categories?.name;
    if (cname) {
      if (!groupedBestsellers[cname]) {
        groupedBestsellers[cname] = {
          name: cname,
          products: []
        };
      }
      groupedBestsellers[cname].products.push(p);
    }
  });
  const categoryCards = Object.values(groupedBestsellers).slice(0, 16);

  const [orderCounts, setOrderCounts] = useState({});

  useEffect(() => {
    let isMounted = true;
    const fetchOrderStats = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('items')
          .limit(100);

        if (!error && data) {
          const counts = {};
          data.forEach(order => {
            if (Array.isArray(order.items)) {
              order.items.forEach(item => {
                if (item?.id) {
                  const qty = Number(item.qty || item.quantity || 1);
                  counts[item.id] = (counts[item.id] || 0) + (qty > 0 ? qty : 1);
                }
              });
            }
          });
          if (isMounted) setOrderCounts(counts);
        }
      } catch (err) {
        console.warn("Could not load order statistics:", err);
      }
    };
    fetchOrderStats();
    return () => { isMounted = false; };
  }, []);

  // Live Database Sync for Curated Sections
  const budgetUnder49 = allProducts.filter(p => p.price <= 49 && !p.is_out_of_stock && p.stock_count !== 0);
  const budgetUnder99 = allProducts.filter(p => p.price > 49 && p.price <= 99 && !p.is_out_of_stock && p.stock_count !== 0);
  const trendingProducts = allProducts
    .filter(p => !p.is_out_of_stock && p.stock_count !== 0)
    .sort((a, b) => {
      const countA = orderCounts[a.id] || 0;
      const countB = orderCounts[b.id] || 0;
      if (countB !== countA) return countB - countA;
      // Secondary fallback to bestsellers or recency
      if (b.is_bestseller && !a.is_bestseller) return 1;
      if (a.is_bestseller && !b.is_bestseller) return -1;
      return 0;
    })
    .slice(0, 6);

  // 1. Dairy, Bakery & Tea Store (Milks & Breads, Tea & Coffee, Biscuits)
  const breakfastCatNames = ['Milks & Breads', 'Tea & Coffee', 'Biscuits'];
  const breakfastProducts = allProducts.filter(p => {
    if (p.is_out_of_stock || p.stock_count === 0) return false;
    const catName = p.categories?.name || '';
    return breakfastCatNames.some(c => c.toLowerCase() === catName.trim().toLowerCase());
  }).slice(0, 8);

  // 2. Kitchen Staples & Cooking Essentials (Atta , Dal  & Rice, Oil , Ghee & Masala)
  const kitchenCatNames = ['Atta , Dal  & Rice', 'Oil , Ghee & Masala'];
  const kitchenStaples = allProducts.filter(p => {
    if (p.is_out_of_stock || p.stock_count === 0) return false;
    const catName = p.categories?.name || '';
    return kitchenCatNames.some(c => c.toLowerCase() === catName.trim().toLowerCase());
  }).slice(0, 8);

  // 3. Bath, Body & Home Cleaning (Soaps, Detergents, Hair Oils, Medications)
  const personalCareCatNames = ['Soaps', 'Detergents', 'Hair Oils', 'Medications'];
  const personalCare = allProducts.filter(p => {
    if (p.is_out_of_stock || p.stock_count === 0) return false;
    const catName = p.categories?.name || '';
    return personalCareCatNames.some(c => c.toLowerCase() === catName.trim().toLowerCase());
  }).slice(0, 8);

  const [activeBudgetTab, setActiveBudgetTab] = useState('under49');

  return (
    <main className="product-grid-container">

      {/* 1. Bestsellers Categories Window */}
      {categoryCards.length > 0 && (
        <section className="grid-products-section" style={{marginBottom: 24}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
            <h2 className="section-title" style={{fontSize: '17px', fontWeight: 800, marginBottom: 0, color: '#000', letterSpacing: '-0.5px'}}>Bestsellers</h2>
          </div>
          <div className="bestseller-categories-grid">
            {categoryCards.map((cat, idx) => {
              const gridImgs = cat.products.map(p => p.image_url).filter(Boolean).slice(0, 4);
              const remainingCount = Math.max(0, cat.products.length - 4);
              return (
                <div key={idx} className="bestseller-category-card stagger-item" onClick={() => setSelectedBestsellerCategory(cat)}>
                  <div className="category-window-grid">
                    {gridImgs.map((img, i) => <img key={i} src={img} alt="" />)}
                    {remainingCount > 0 && (
                      <div className="category-more-pill">+{remainingCount} more</div>
                    )}
                  </div>
                  <div className="bestseller-category-name">{cat.name}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. Pinnacle of Collection */}
      {gridProducts.length > 0 && (
        <section className="grid-products-section" style={{marginBottom: 32}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', margin: 0, padding: 0 }}>
              <h2 className="section-title" style={{fontSize: '17px', fontWeight: 800, marginBottom: 0, color: '#000', letterSpacing: '-0.5px', margin: 0, padding: 0}}>Pinnacle of our collection</h2>
              <span style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: '600', marginTop: '2px', display: 'block', margin: '2px 0 0 0', padding: 0 }}>Finest selection of products</span>
            </div>
          </div>
          <div className="pinnacle-grid">
            {gridProducts.slice(0, 6).map((item, idx) => {
              const cartItem = cart.find(c => c.id === item.id);
              const qty = cartItem ? cartItem.qty : 0;
              return (
                <div key={item.id || idx} className="bestseller-card stagger-item" onClick={() => onProductClick && onProductClick(item)}>
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
                      loading={idx < 4 ? "eager" : "lazy"} 
                      decoding="async"
                      style={{ opacity: (item.is_out_of_stock || item.stock_count === 0) ? 0.4 : 1 }} 
                    />
                  </div>
                  <div className="img-footer-row" onClick={e => e.stopPropagation()}>
                    <span className="item-amount-text">{item.amount}</span>
                    {item.is_out_of_stock || item.stock_count === 0 ? (
                      <button className="add-btn-small" style={{background: '#f2f4f7', color: '#98a2b3', border: '1px solid #e4e7ec'}} disabled>ADD</button>
                    ) : qty === 0 ? (
                      <button className="add-btn-small" onClick={() => updateCartQty(item, 1)}>ADD</button>
                    ) : (
                      <div className="qty-control">
                        <button onClick={() => updateCartQty(item, -1)}>-</button>
                        <span>{qty}</span>
                        <button onClick={() => {
                           if (item.stock_count > 0 && qty >= item.stock_count) {
                             alert(`Only ${item.stock_count} left in stock!`);
                           } else {
                             updateCartQty(item, 1);
                           }
                        }}>+</button>
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
          <button className="explore-all-btn" onClick={() => navigate('/all-products')}>
            <div className="explore-all-images">
              {gridProducts.slice(0, 4).map(p => (
                <img key={p.id} src={p.image_url} alt="" />
              ))}
            </div>
            <div className="explore-all-text">
              <span>Explore All Products</span>
              <ArrowRight size={18} />
            </div>
          </button>
        </section>
      )}

      {/* 4. Trust Banner */}
      <div style={{ background: 'linear-gradient(135deg, #166534 0%, #15803d 100%)', color: '#ffffff', borderRadius: '18px', padding: '16px 20px', margin: '10px 0 28px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center', boxShadow: '0 4px 14px rgba(22, 101, 52, 0.2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <Zap size={20} color="#fef08a" />
          <span style={{ fontSize: '11.5px', fontWeight: 800, lineHeight: 1.2 }}>15-30 Mins</span>
          <span style={{ fontSize: '10px', opacity: 0.85 }}>Ultra Fast Delivery</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.2)', borderRight: '1px solid rgba(255,255,255,0.2)' }}>
          <ShieldCheck size={20} color="#fef08a" />
          <span style={{ fontSize: '11.5px', fontWeight: 800, lineHeight: 1.2 }}>100% Quality</span>
          <span style={{ fontSize: '10px', opacity: 0.85 }}>Freshness Assured</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <Sparkles size={20} color="#fef08a" />
          <span style={{ fontSize: '11.5px', fontWeight: 800, lineHeight: 1.2 }}>Best Prices</span>
          <span style={{ fontSize: '10px', opacity: 0.85 }}>COD Available</span>
        </div>
      </div>

      {/* 5. Trending In Your Area Section */}
      {trendingProducts.length > 0 && (
        <section className="grid-products-section" style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <h2 className="section-title" style={{ fontSize: '17px', fontWeight: 800, marginBottom: 0, color: 'var(--color-text)', letterSpacing: '-0.5px' }}>
                Trending In Your Area
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: '600', marginTop: '2px' }}>
                Popular daily picks ordered right now
              </span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 800, background: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5', padding: '4px 10px', borderRadius: '20px' }}>
              Top Sellers
            </span>
          </div>

          <div className="pinnacle-grid">
            {trendingProducts.map((item) => {
              const cartItem = cart.find(c => c.id === item.id);
              const qty = cartItem ? cartItem.qty : 0;
              const buyCount = orderCounts[item.id] || 0;
              return (
                <div key={'trending_' + item.id} className="bestseller-card stagger-item" onClick={() => onProductClick && onProductClick(item)}>
                  <div className="bestseller-img-wrapper">
                    <div className="wishlist-btn-corner" onClick={(e) => { e.stopPropagation(); toggleWishlist(item.id); }}>
                      <Heart size={15} fill={isInWishlist(item.id) ? '#e91e63' : 'transparent'} color={isInWishlist(item.id) ? '#e91e63' : 'var(--color-text-light)'} />
                    </div>
                    <div className="bestseller-img">
                      <img src={item.image_url} alt={item.name} loading="lazy" />
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
                    <div className="item-price">₹{item.price}</div>
                    <h3 className="item-name">{item.name}</h3>
                    <div className="time-tag">⏱ {getProductDeliveryTime(item.name)} MINS</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Budget Store Section */}
      <section className="grid-products-section budget-store-section" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', margin: 0, padding: 0 }}>
            <h2 className="section-title" style={{fontSize: '17px', fontWeight: 800, marginBottom: 0, color: '#000', letterSpacing: '-0.5px', padding: 0, margin: 0}}>Budget Store</h2>
            <span style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: '600', marginTop: '2px', display: 'block', padding: 0, margin: '2px 0 0 0' }}>Pocket-friendly daily essentials</span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 800, background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', padding: '4px 10px', borderRadius: '20px' }}>
            Up to 40% OFF
          </span>
        </div>

        {/* Premium Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--color-surface-muted, #f1f5f9)', padding: '4px', borderRadius: '16px', marginBottom: '16px', border: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setActiveBudgetTab('under49')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '12px',
              border: 'none',
              background: activeBudgetTab === 'under49' ? '#0c831f' : 'transparent',
              color: activeBudgetTab === 'under49' ? '#ffffff' : 'var(--color-text-light)',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeBudgetTab === 'under49' ? '0 4px 14px rgba(12, 131, 31, 0.3)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Flame size={16} color={activeBudgetTab === 'under49' ? '#ffffff' : '#f97316'} /> Under ₹49 Store
          </button>
          <button
            onClick={() => setActiveBudgetTab('under99')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '12px',
              border: 'none',
              background: activeBudgetTab === 'under99' ? '#0c831f' : 'transparent',
              color: activeBudgetTab === 'under99' ? '#ffffff' : 'var(--color-text-light)',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeBudgetTab === 'under99' ? '0 4px 14px rgba(12, 131, 31, 0.3)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Zap size={16} color={activeBudgetTab === 'under99' ? '#ffffff' : '#eab308'} /> Under ₹99 Store
          </button>
        </div>

        {/* Grid Product List */}
        <div className="pinnacle-grid" style={{ paddingBottom: '8px' }}>
          {(activeBudgetTab === 'under49' ? budgetUnder49 : budgetUnder99).slice(0, 6).map((item) => {
            const cartItem = cart.find(c => c.id === item.id);
            const qty = cartItem ? cartItem.qty : 0;
            return (
              <div
                key={item.id}
                className="bestseller-card stagger-item"
                onClick={() => onProductClick && onProductClick(item)}
              >
                <div className="bestseller-img-wrapper">
                  <div className="wishlist-btn-corner" onClick={(e) => { e.stopPropagation(); toggleWishlist(item.id); }}>
                    <Heart size={16} fill={isInWishlist(item.id) ? '#e91e63' : 'transparent'} color={isInWishlist(item.id) ? '#e91e63' : 'var(--color-text-light)'} />
                  </div>
                  <div className="bestseller-img">
                    <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" />
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
                  <div className="item-price">₹{item.price}</div>
                  <h3 className="item-name">{item.name}</h3>
                  <div className="time-tag">⏱ {getProductDeliveryTime(item.name)} MINS</div>
                </div>
              </div>
            );
          })}
        </div>

        <button 
          className="explore-all-btn" 
          style={{ marginTop: '16px' }} 
          onClick={() => navigate(`/category/${activeBudgetTab === 'under49' ? 'budget-49' : 'budget-99'}`, { state: { categoryName: activeBudgetTab === 'under49' ? 'Under ₹49 Store' : 'Under ₹99 Store' } })}
        >
          <div className="explore-all-images">
            {(activeBudgetTab === 'under49' ? budgetUnder49 : budgetUnder99).slice(0, 4).map(p => (
              <img key={p.id} src={p.image_url} alt="" />
            ))}
          </div>
          <div className="explore-all-text">
            <span>View Budget Store</span>
            <ArrowRight size={18} />
          </div>
        </button>
      </section>

      {/* 4. Dairy, Bakery & Tea */}
      {breakfastProducts.length > 0 && (
        <section className="grid-products-section" style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <h2 className="section-title" style={{ fontSize: '17px', fontWeight: 800, marginBottom: 0, color: 'var(--color-text)', letterSpacing: '-0.5px' }}>
                Dairy, Bakery & Tea
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: '600', marginTop: '2px' }}>
                Milks, breads, tea, coffee & biscuits
              </span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 800, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: '20px' }}>
              Fresh Daily
            </span>
          </div>

          <div className="pinnacle-grid">
            {breakfastProducts.map((item) => {
              const cartItem = cart.find(c => c.id === item.id);
              const qty = cartItem ? cartItem.qty : 0;
              return (
                <div key={'bf_' + item.id} className="bestseller-card stagger-item" onClick={() => onProductClick && onProductClick(item)}>
                  <div className="bestseller-img-wrapper">
                    <div className="wishlist-btn-corner" onClick={(e) => { e.stopPropagation(); toggleWishlist(item.id); }}>
                      <Heart size={16} fill={isInWishlist(item.id) ? '#e91e63' : 'transparent'} color={isInWishlist(item.id) ? '#e91e63' : 'var(--color-text-light)'} />
                    </div>
                    <div className="bestseller-img">
                      <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" />
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
                    <div className="item-price">₹{item.price}</div>
                    <h3 className="item-name">{item.name}</h3>
                    <div className="time-tag">⏱ {getProductDeliveryTime(item.name)} MINS</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. Atta, Dal, Oil & Masala */}
      {kitchenStaples.length > 0 && (
        <section className="grid-products-section" style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <h2 className="section-title" style={{ fontSize: '17px', fontWeight: 800, marginBottom: 0, color: 'var(--color-text)', letterSpacing: '-0.5px' }}>
                Atta, Dal, Oil & Masala
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: '600', marginTop: '2px' }}>
                Atta, dal, rice, oils, ghee & spices
              </span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 800, background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', padding: '4px 10px', borderRadius: '20px' }}>
              Pantry Best
            </span>
          </div>

          <div className="pinnacle-grid">
            {kitchenStaples.map((item) => {
              const cartItem = cart.find(c => c.id === item.id);
              const qty = cartItem ? cartItem.qty : 0;
              return (
                <div key={'staple_' + item.id} className="bestseller-card stagger-item" onClick={() => onProductClick && onProductClick(item)}>
                  <div className="bestseller-img-wrapper">
                    <div className="wishlist-btn-corner" onClick={(e) => { e.stopPropagation(); toggleWishlist(item.id); }}>
                      <Heart size={16} fill={isInWishlist(item.id) ? '#e91e63' : 'transparent'} color={isInWishlist(item.id) ? '#e91e63' : 'var(--color-text-light)'} />
                    </div>
                    <div className="bestseller-img">
                      <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" />
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
                    <div className="item-price">₹{item.price}</div>
                    <h3 className="item-name">{item.name}</h3>
                    <div className="time-tag">⏱ {getProductDeliveryTime(item.name)} MINS</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Bath, Body & Cleaning Essentials */}
      {personalCare.length > 0 && (
        <section className="grid-products-section" style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <h2 className="section-title" style={{ fontSize: '17px', fontWeight: 800, marginBottom: 0, color: 'var(--color-text)', letterSpacing: '-0.5px' }}>
                Bath, Body & Cleaning
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--color-text-light)', fontWeight: '600', marginTop: '2px' }}>
                Soaps, detergents, hair oils & daily care
              </span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 800, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '20px' }}>
              Daily Clean
            </span>
          </div>

          <div className="pinnacle-grid">
            {personalCare.map((item) => {
              const cartItem = cart.find(c => c.id === item.id);
              const qty = cartItem ? cartItem.qty : 0;
              return (
                <div key={'pc_' + item.id} className="bestseller-card stagger-item" onClick={() => onProductClick && onProductClick(item)}>
                  <div className="bestseller-img-wrapper">
                    <div className="wishlist-btn-corner" onClick={(e) => { e.stopPropagation(); toggleWishlist(item.id); }}>
                      <Heart size={16} fill={isInWishlist(item.id) ? '#e91e63' : 'transparent'} color={isInWishlist(item.id) ? '#e91e63' : 'var(--color-text-light)'} />
                    </div>
                    <div className="bestseller-img">
                      <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" />
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
                    <div className="item-price">₹{item.price}</div>
                    <h3 className="item-name">{item.name}</h3>
                    <div className="time-tag">⏱ {getProductDeliveryTime(item.name)} MINS</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 7. Categories Grid */}
      <CategoriesPage navigate={navigate} isEmbedded={true} />

      {/* 8. App Motto Section */}
      <section className="grid-products-section app-motto-section" style={{ marginTop: 40, marginBottom: 80, padding: '20px 16px', border: 'none', background: 'transparent' }}>
        <h1 style={{ fontSize: '42px', fontWeight: 900, color: 'var(--color-text-muted, #444)', lineHeight: '1.1', letterSpacing: '-1.5px', marginBottom: '24px' }}>
          India's rural<br />delivery app <Heart fill="#ff5252" color="#ff5252" style={{ display: 'inline-block', verticalAlign: 'middle', width: '36px', height: '36px' }} />
        </h1>
        <div style={{ position: 'relative', height: '1px', background: 'var(--color-border)', width: '100%', marginBottom: '24px' }}>
          <div style={{ position: 'absolute', right: 0, top: '-4px', borderTop: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', width: '8px', height: '8px', transform: 'rotate(45deg)' }}></div>
        </div>
        <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--color-text-muted, #555)', letterSpacing: '-1px' }}>
          zipit
        </div>
      </section>

      {/* Bestseller Bottom Sheet */}
      {selectedBestsellerCategory && createPortal(
        <div className="bestseller-bottom-sheet-overlay" onClick={() => setSelectedBestsellerCategory(null)}>
          <div className="bestseller-bottom-sheet" onClick={e => e.stopPropagation()}>
            <button className="bestseller-sheet-close-btn" onClick={() => setSelectedBestsellerCategory(null)}>
              <X size={20} />
            </button>
            <div className="bestseller-sheet-header">
              <h2>{selectedBestsellerCategory.name}</h2>
            </div>
            <div className="bestseller-sheet-content">
              <div className="pinnacle-grid">
                {selectedBestsellerCategory.products.map((item, idx) => {
                  const cartItem = cart.find(c => c.id === item.id);
                  const qty = cartItem ? cartItem.qty : 0;
                  return (
                    <div key={item.id || idx} className="bestseller-card" onClick={() => onProductClick && onProductClick(item)}>
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
            </div>
          </div>
        </div>,
        document.body
      )}

    </main>
  );
};

export default ProductGrid;
