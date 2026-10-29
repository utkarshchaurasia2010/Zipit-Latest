import React, { useState, useEffect } from 'react';
import { db, supabase } from '../services/db';
import './CategoriesPage.css';

const CategoriesPage = ({ navigate, isEmbedded }) => {
  const [sections, setSections] = useState(() => {
    try {
      const cached = localStorage.getItem('zipit_cached_categories');
      if (cached) {
        const data = JSON.parse(cached);
        const grouped = data.reduce((acc, cat) => {
          if (!acc[cat.section]) acc[cat.section] = [];
          acc[cat.section].push(cat);
          return acc;
        }, {});
        return Object.keys(grouped).map(sectionTitle => ({
          title: sectionTitle,
          items: grouped[sectionTitle]
        }));
      }
    } catch (_) {}
    return [];
  });
  
  const [loading, setLoading] = useState(sections.length === 0);

  useEffect(() => {
    let isMounted = true;
    const fetchCats = async () => {
      try {
        const data = await db.categories.getAll();
        if (!isMounted) return;
        
        // Group by section
        const grouped = (data || []).reduce((acc, cat) => {
          const sec = cat.section || 'Featured';
          if (!acc[sec]) acc[sec] = [];
          acc[sec].push(cat);
          return acc;
        }, {});
        
        const structuredSections = Object.keys(grouped).map(sectionTitle => ({
          title: sectionTitle,
          items: grouped[sectionTitle]
        }));
        
        setSections(structuredSections);
      } catch (e) {
        console.warn('Error fetching categories:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchCats();

    const handleAppRefresh = () => {
      fetchCats();
    };
    window.addEventListener('app:refresh', handleAppRefresh);

    const channel = supabase.channel('realtime:categories_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        fetchCats();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      window.removeEventListener('app:refresh', handleAppRefresh);
    };
  }, []);

  return (
    <div className={`categories-page-container ${isEmbedded ? 'embedded' : ''}`}>
      <div className="categories-scroll-area">
        {loading && sections.length === 0 ? (
          <div style={{ padding: '20px' }}>
            <div style={{ height: '20px', width: '120px', background: '#e2e8f0', borderRadius: '6px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }}></div>
            <div className="category-grid-layout">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '100%', aspectRatio: '1', borderRadius: '12px', background: '#f1f5f9', animation: 'pulse 1.5s infinite' }}></div>
                  <div style={{ width: '60px', height: '10px', background: '#e2e8f0', borderRadius: '4px' }}></div>
                </div>
              ))}
            </div>
          </div>
        ) : sections.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-light)' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px' }}>No Products</div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--color-text)' }}>No Categories Available</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Check back soon as new products are being added!</div>
          </div>
        ) : (
          sections.map((section, idx) => (
            <div key={idx} className="category-section">
              <h3 className="category-section-title">{section.title}</h3>
              <div className="category-horizontal-scroll">
                <div className="category-grid-layout">
                  {section.items.map((item, i) => (
                    <div key={item.id || i} className="category-card" onClick={() => navigate(`/category/${item.id}`, { state: { categoryName: item.name } })}>
                      <div className="category-card-img-wrap">
                        <img 
                          src={item.image_url} 
                          alt={item.name} 
                          loading="lazy" 
                          decoding="async" 
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80';
                          }}
                        />
                      </div>
                      <span className="category-card-name">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
export default CategoriesPage;
