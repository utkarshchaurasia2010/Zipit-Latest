import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, 
  Sparkles, Layers, Save, Check, X, Search, Tag, RefreshCw, AlertCircle
} from 'lucide-react';
import { db, supabase } from '../services/db';
import { useToast } from '../context/ToastContext';
import './SectionsManager.css';

export const DEFAULT_HOMEPAGE_SECTIONS = [
  {
    id: 'sec_bestsellers',
    title: 'Bestsellers',
    subtitle: 'Top category windows',
    badge: 'Popular',
    type: 'bestsellers_window',
    enabled: true,
    is_system: true
  },
  {
    id: 'sec_pinnacle',
    title: 'Pinnacle of our collection',
    subtitle: 'Finest selection of products',
    badge: 'Curated',
    type: 'pinnacle_grid',
    enabled: true,
    is_system: true
  },
  {
    id: 'sec_trust',
    title: 'Trust & Speed Guarantees',
    subtitle: '15-30 Mins • Quality Assured • Best Prices',
    badge: 'Guarantees',
    type: 'trust_banner',
    enabled: true,
    is_system: true
  },
  {
    id: 'sec_trending',
    title: 'Trending In Your Area',
    subtitle: 'Popular daily picks ordered right now',
    badge: 'Top Sellers',
    type: 'trending_grid',
    enabled: true,
    is_system: true
  },
  {
    id: 'sec_budget',
    title: 'Budget Store',
    subtitle: 'Under ₹49 & Under ₹99 pocket-friendly essentials',
    badge: 'Up to 40% OFF',
    type: 'budget_store',
    enabled: true,
    is_system: true
  },
  {
    id: 'sec_dairy',
    title: 'Dairy, Bakery & Tea',
    subtitle: 'Milks, breads, tea, coffee & biscuits',
    badge: 'Fresh Daily',
    type: 'category_filter',
    categories: ['Milks & Breads', 'Tea & Coffee', 'Biscuits'],
    enabled: true,
    is_system: true
  },
  {
    id: 'sec_staples',
    title: 'Atta, Dal, Oil & Masala',
    subtitle: 'Atta, dal, rice, oils, ghee & spices',
    badge: 'Pantry Best',
    type: 'category_filter',
    categories: ['Atta , Dal  & Rice', 'Oil , Ghee & Masala'],
    enabled: true,
    is_system: true
  },
  {
    id: 'sec_cleaning',
    title: 'Bath, Body & Cleaning',
    subtitle: 'Soaps, detergents, hair oils & daily care',
    badge: 'Daily Clean',
    type: 'category_filter',
    categories: ['Soaps', 'Detergents', 'Hair Oils', 'Medications'],
    enabled: true,
    is_system: true
  },
  {
    id: 'sec_categories',
    title: 'Explore All Categories',
    subtitle: 'Visual category grid showcase',
    badge: 'Categories',
    type: 'categories_grid',
    enabled: true,
    is_system: true
  }
];

const SectionsManager = () => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [categoriesList, setCategoriesList] = useState([]);
  const [productsList, setProductsList] = useState([]);

  // Modal State for Adding/Editing Section
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    badge: 'Special Offer',
    type: 'custom_products', // 'custom_products' | 'category_filter'
    selectedCategory: '',
    selectedProductIds: [],
    enabled: true
  });
  const [prodSearchQuery, setProdSearchQuery] = useState('');

  const { showToast } = useToast();

  useEffect(() => {
    loadSectionsAndData();
  }, []);

  const loadSectionsAndData = async () => {
    setLoading(true);
    try {
      const [branding, cats, prods] = await Promise.all([
        db.branding.get(),
        db.categories.getAll(),
        db.products.getAll()
      ]);

      setCategoriesList(cats || []);
      setProductsList(prods || []);

      if (branding && Array.isArray(branding.homepage_sections) && branding.homepage_sections.length > 0) {
        setSections(branding.homepage_sections);
      } else {
        setSections(DEFAULT_HOMEPAGE_SECTIONS);
      }
    } catch (err) {
      console.error('Error loading sections:', err);
      showToast('Error loading sections configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAllSections = async (newSections) => {
    const listToSave = newSections || sections;
    setSaving(true);
    try {
      const branding = (await db.branding.get()) || {};
      const updated = {
        ...branding,
        homepage_sections: listToSave
      };
      await db.branding.update(updated);
      setHasChanges(false);
      showToast('Homepage sections saved & synced live to customers!', 'success');
    } catch (err) {
      console.error('Error saving sections:', err);
      showToast('Failed to save sections: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const moveSection = (index, direction) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const updated = [...sections];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIdx, 0, moved);
    setSections(updated);
    setHasChanges(true);
  };

  const toggleSectionEnabled = (id) => {
    const updated = sections.map(sec => 
      sec.id === id ? { ...sec, enabled: !sec.enabled } : sec
    );
    setSections(updated);
    setHasChanges(true);
  };

  const handleDeleteSection = (id) => {
    const sec = sections.find(s => s.id === id);
    if (!sec) return;
    if (sec.is_system) {
      showToast('System sections cannot be deleted, but you can disable them or move their position.', 'error');
      return;
    }
    if (window.confirm(`Are you sure you want to remove section "${sec.title}"?`)) {
      const updated = sections.filter(s => s.id !== id);
      setSections(updated);
      setHasChanges(true);
    }
  };

  const openCreateModal = () => {
    setEditingSection(null);
    setFormData({
      title: 'Diwali Special Sweets & Gifts',
      subtitle: 'Festive treats and celebration hampers',
      badge: 'Festive Sale',
      type: 'custom_products',
      selectedCategory: categoriesList[0]?.name || '',
      selectedProductIds: [],
      enabled: true
    });
    setProdSearchQuery('');
    setIsModalOpen(true);
  };

  const openEditModal = (sec) => {
    setEditingSection(sec);
    setFormData({
      title: sec.title || '',
      subtitle: sec.subtitle || '',
      badge: sec.badge || '',
      type: sec.type || 'custom_products',
      selectedCategory: sec.categories ? sec.categories[0] : (categoriesList[0]?.name || ''),
      selectedProductIds: sec.product_ids || [],
      enabled: sec.enabled !== false
    });
    setProdSearchQuery('');
    setIsModalOpen(true);
  };

  const handleModalSave = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Section title is required', 'error');
      return;
    }

    if (editingSection) {
      // Update existing section
      const updated = sections.map(sec => {
        if (sec.id === editingSection.id) {
          return {
            ...sec,
            title: formData.title.trim(),
            subtitle: formData.subtitle.trim(),
            badge: formData.badge.trim(),
            type: formData.type,
            categories: formData.type === 'category_filter' ? [formData.selectedCategory] : undefined,
            product_ids: formData.type === 'custom_products' ? formData.selectedProductIds : undefined,
            enabled: formData.enabled
          };
        }
        return sec;
      });
      setSections(updated);
    } else {
      // Create new custom section
      const newSec = {
        id: 'sec_custom_' + Date.now(),
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim(),
        badge: formData.badge.trim(),
        type: formData.type,
        categories: formData.type === 'category_filter' ? [formData.selectedCategory] : undefined,
        product_ids: formData.type === 'custom_products' ? formData.selectedProductIds : undefined,
        enabled: formData.enabled,
        is_system: false
      };
      // Place new festive section near the top (e.g. index 1 right after bestsellers)
      const updated = [newSec, ...sections];
      setSections(updated);
    }

    setIsModalOpen(false);
    setHasChanges(true);
    showToast('Section configuration updated! Remember to click Save Changes.', 'success');
  };

  const toggleSelectProduct = (productId) => {
    setFormData(prev => {
      const exists = prev.selectedProductIds.includes(productId);
      const nextIds = exists 
        ? prev.selectedProductIds.filter(id => id !== productId)
        : [...prev.selectedProductIds, productId];
      return { ...prev, selectedProductIds: nextIds };
    });
  };

  const filteredProducts = productsList.filter(p => 
    p.name.toLowerCase().includes(prodSearchQuery.toLowerCase())
  );

  return (
    <div className="sections-manager-container">
      {/* Header */}
      <div className="sections-manager-header">
        <div>
          <h2>Homepage Sections & Priority</h2>
          <p>Organize, reorder, create festive campaigns, and customize homepage storefront sections</p>
        </div>
        <div className="sections-header-actions">
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={openCreateModal}
          >
            <Plus size={18} />
            <span>Create Festive Section</span>
          </button>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => handleSaveAllSections()}
            disabled={saving || !hasChanges}
          >
            <Save size={18} />
            <span>{saving ? 'Publishing...' : hasChanges ? 'Publish Changes Live' : 'Sections Published'}</span>
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="sections-banner-info">
        <div className="icon-box">
          <Sparkles size={22} />
        </div>
        <div>
          <h4>Festive Season & Dynamic Priority Controls</h4>
          <p>
            Use the arrow controls to prioritize which sections customers see first on the homepage.
            You can create special festive banners, select specific holiday items, or hide/show sections at will.
          </p>
        </div>
      </div>

      {/* Sections List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-light)' }}>
          Loading sections configuration...
        </div>
      ) : (
        <div className="sections-list">
          {sections.map((sec, idx) => (
            <div 
              key={sec.id} 
              className={`section-card-item ${!sec.enabled ? 'disabled' : ''}`}
            >
              <div className="section-card-left">
                <div className="section-priority-pill" title={`Priority Order: #${idx + 1}`}>
                  {idx + 1}
                </div>

                <div className="section-info">
                  <div className="section-title-row">
                    <h4 className="section-title-text">{sec.title}</h4>
                    {sec.badge && (
                      <span className="section-tag-badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                        {sec.badge}
                      </span>
                    )}
                    <span className={`section-tag-badge ${sec.is_system ? 'tag-system' : 'tag-custom'}`}>
                      {sec.is_system ? 'System Section' : 'Custom Festive'}
                    </span>
                    {!sec.enabled && (
                      <span className="section-tag-badge" style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                        Hidden from Customers
                      </span>
                    )}
                  </div>
                  <p className="section-desc-text">{sec.subtitle || 'Custom curated storefront section'}</p>
                  
                  <div className="section-meta-chips">
                    <span className="meta-chip">Type: {sec.type.replace('_', ' ')}</span>
                    {sec.categories && (
                      <span className="meta-chip">Categories: {sec.categories.join(', ')}</span>
                    )}
                    {sec.product_ids && (
                      <span className="meta-chip" style={{ color: '#0c831f', fontWeight: 700 }}>
                        {sec.product_ids.length} Selected Products
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="section-card-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title="Move Up"
                  disabled={idx === 0}
                  onClick={() => moveSection(idx, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Move Down"
                  disabled={idx === sections.length - 1}
                  onClick={() => moveSection(idx, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title={sec.enabled ? 'Hide from Customers' : 'Show on Homepage'}
                  onClick={() => toggleSectionEnabled(sec.id)}
                  style={{ color: sec.enabled ? '#0c831f' : '#dc2626' }}
                >
                  {sec.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Customize Section"
                  onClick={() => openEditModal(sec)}
                >
                  <Edit2 size={16} />
                </button>
                {!sec.is_system && (
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Delete Custom Section"
                    onClick={() => handleDeleteSection(sec.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT SECTION MODAL */}
      {isModalOpen && (
        <div className="section-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="section-modal-box" onClick={e => e.stopPropagation()}>
            <div className="section-modal-header">
              <h3>{editingSection ? `Customize: ${editingSection.title}` : 'Create Festive / Special Section'}</h3>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleModalSave}>
              <div className="section-modal-body">
                <div>
                  <label className="form-label">Section Heading Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Diwali Dhamaka Deals or Holi Specials"
                    className="input-text"
                  />
                </div>

                <div>
                  <label className="form-label">Subtitle Description</label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={e => setFormData({ ...formData, subtitle: e.target.value })}
                    placeholder="e.g. Special festive gifts, pooja items & sweets"
                    className="input-text"
                  />
                </div>

                <div>
                  <label className="form-label">Badge Tag</label>
                  <input
                    type="text"
                    value={formData.badge}
                    onChange={e => setFormData({ ...formData, badge: e.target.value })}
                    placeholder="e.g. Up to 50% OFF, Limited Edition, Festive"
                    className="input-text"
                  />
                </div>

                {!editingSection?.is_system && (
                  <div>
                    <label className="form-label">Section Content Source</label>
                    <select
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value })}
                      className="select-input"
                    >
                      <option value="custom_products">Handpicked Custom Products (Select below)</option>
                      <option value="category_filter">Specific Category Products</option>
                    </select>
                  </div>
                )}

                {!editingSection?.is_system && formData.type === 'category_filter' && (
                  <div>
                    <label className="form-label">Target Category</label>
                    <select
                      value={formData.selectedCategory}
                      onChange={e => setFormData({ ...formData, selectedCategory: e.target.value })}
                      className="select-input"
                    >
                      {categoriesList.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {!editingSection?.is_system && formData.type === 'custom_products' && (
                  <div>
                    <label className="form-label">
                      Select Festive Products ({formData.selectedProductIds.length} selected)
                    </label>
                    <span className="form-sublabel">
                      Click products to include in this custom section. They will show in the order selected.
                    </span>

                    <div style={{ position: 'relative', marginBottom: '8px' }}>
                      <input
                        type="text"
                        placeholder="Search products to add..."
                        value={prodSearchQuery}
                        onChange={e => setProdSearchQuery(e.target.value)}
                        className="input-text"
                        style={{ paddingLeft: '34px' }}
                      />
                      <Search size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--color-text-light)' }} />
                    </div>

                    <div className="products-selector-list">
                      {filteredProducts.slice(0, 40).map(p => {
                        const isSelected = formData.selectedProductIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            className={`product-selector-row ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleSelectProduct(p.id)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by parent onClick
                            />
                            {p.image_url && <img src={p.image_url} alt="" />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text)' }}>{p.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-light)' }}>
                                ₹{p.price} • {p.categories?.name || 'Item'}
                              </div>
                            </div>
                            {isSelected && (
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#15803d' }}>SELECTED</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="toggle-switch-wrapper">
                  <div>
                    <strong style={{ fontSize: '13.5px', color: 'var(--color-text)', display: 'block' }}>Visible on Homepage</strong>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>Toggle whether this section appears on customer home screens</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>
              </div>

              <div className="section-modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Save Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectionsManager;
