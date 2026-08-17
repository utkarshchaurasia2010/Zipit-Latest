import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import HeroCarousel from './HeroCarousel';
import './HeroSection.css';

const HeroSection = ({ onImageChange, cart, updateCartQty, navigate }) => {
  const [carouselProducts, setCarouselProducts] = useState([]);
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    const fetchBannersAndProducts = async () => {
      const waferData = await db.WAFER.getAll();
      if (waferData.length > 0) {
        // Sort by order_index
        const sorted = [...waferData].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        setBanners(sorted);
        if (onImageChange) {
          const first = sorted[0];
          const bannerUrl = first.image_url && first.image_url !== 'https://none.com/none.png' && first.image_url !== 'NONE'
            ? first.image_url
            : '';
          onImageChange(bannerUrl || first.bg_color);
        }
      }

      const allProducts = await db.products.getAll();
      const specials = allProducts.filter(p => p.is_carousel);
      setCarouselProducts(specials);
    };
    fetchBannersAndProducts();
  }, [onImageChange]);

  const handleBannerClick = (banner) => {
    if (banner.link_url) {
      window.open(banner.link_url, '_blank', 'noopener,noreferrer');
    }
  };

  const hasBanner = banners.length > 0;
  const hasProducts = carouselProducts.length > 0;

  if (!hasBanner && !hasProducts) return null;

  return (
    <div className="hero-section-wrapper">
      {/* ── Premium Banner Carousel ── */}
      {hasBanner && (
        <HeroCarousel banners={banners} onBannerClick={handleBannerClick} />
      )}

      {/* ── Category Shortcut Cards ── */}
      {hasProducts && (
        <div className="hero-products-container" style={{ marginTop: hasBanner ? '10px' : '8px' }}>
          {carouselProducts.slice(0, 4).map(prod => (
            <div
              key={prod.id}
              className="hero-product-card"
              onClick={() => navigate && navigate(`/category/${prod.category_id}`)}
            >
              <div className="hero-prod-title">{prod.categories?.name || 'Category'}</div>
              <div className="hero-prod-img-container">
                <img src={prod.image_url} alt={prod.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HeroSection;
