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
  
  useEffect(() => {
    const fetchCats = async () => {
      const data = await db.categories.getAll();
      
      // Group by section
      const grouped = data.reduce((acc, cat) => {
        if (!acc[cat.section]) acc[cat.section] = [];
        acc[cat.section].push(cat);
        return acc;
      }, {});
      
      const structuredSections = Object.keys(grouped).map(sectionTitle => ({
        title: sectionTitle,
        items: grouped[sectionTitle]
      }));
      
      setSections(structuredSections);
    };
    fetchCats();

    const channel = supabase.channel('realtime:categories_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        fetchCats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className={`categories-page-container ${isEmbedded ? 'embedded' : ''}`}>
      <div className="categories-scroll-area">
      {sections.map((section, idx) => (
        <div key={idx} className="category-section">
          <h3 className="category-section-title">{section.title}</h3>
          <div className="category-horizontal-scroll">
            <div className="category-grid-layout">
              {section.items.map((item, i) => (
                <div key={item.id || i} className="category-card" onClick={() => navigate(`/category/${item.id}`, { state: { categoryName: item.name } })}>
                  <div className="category-card-img-wrap">
                    <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" />
                  </div>
                  <span className="category-card-name">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
};
export default CategoriesPage;
