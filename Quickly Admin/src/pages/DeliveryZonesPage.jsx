import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, 
  Layers, 
  Plus, 
  Check, 
  X, 
  Trash2, 
  Edit3, 
  Navigation, 
  Bike, 
  Clock, 
  ShieldCheck, 
  RotateCcw, 
  Info, 
  Crosshair,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { db, supabase } from '../services/db';
import { isPointInPolygon, calculatePolygonCenter, getDistanceMeters, rankRidersForOrder } from '../utils/geoZones';
import { useToast } from '../context/ToastContext';
import './DeliveryZonesPage.css';

// Fix Leaflet default icon paths in bundled Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const PRESET_COLORS = [
  '#0c831f', // Quickly Green
  '#2563eb', // Royal Blue
  '#7c3aed', // Sunset Purple
  '#d97706', // Amber
  '#dc2626', // Crimson
  '#0d9488', // Teal
  '#ec4899'  // Pink
];

export default function DeliveryZonesPage() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonsLayerGroupRef = useRef(null);
  const drawLayerGroupRef = useRef(null);
  const testMarkerRef = useRef(null);
  const ridersLayerGroupRef = useRef(null);

  const [zones, setZones] = useState([]);
  const [riders, setRiders] = useState([]);
  const [storeCoords, setStoreCoords] = useState([25.6744, 83.4985]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Drawing mode state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]); // Array of [lat, lng]
  
  // Modal / Edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [zoneForm, setZoneForm] = useState({
    id: '',
    name: '',
    code: '',
    color: '#0c831f',
    delivery_time_mins: 15,
    min_order_value: 0,
    delivery_fee: 0,
    assigned_riders: [],
    is_active: true
  });

  // Test simulation state
  const [isTestingLocation, setIsTestingLocation] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { showToast } = useToast();

  // Load zones, store coordinates, and rider statuses
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load System Branding & Store Location & Delivery Zones
      const systemData = await db.branding.get();
      if (systemData) {
        if (systemData.store_lat && systemData.store_lng) {
          setStoreCoords([Number(systemData.store_lat), Number(systemData.store_lng)]);
        }
        if (Array.isArray(systemData.delivery_zones)) {
          setZones(systemData.delivery_zones);
        }
      }

      // 2. Load online riders
      const { data: riderRows } = await supabase.from('rider_status').select('*');
      if (riderRows) {
        setRiders(riderRows);
      }
    } catch (err) {
      console.error('Failed to load delivery zones data:', err);
      showToast('Error loading delivery zones', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: storeCoords,
        zoom: 14,
        zoomControl: true
      });

      // CartoDB Voyager or OSM clean tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19
      }).addTo(map);

      // Layer groups for dynamic rendering
      polygonsLayerGroupRef.current = L.layerGroup().addTo(map);
      drawLayerGroupRef.current = L.layerGroup().addTo(map);
      ridersLayerGroupRef.current = L.layerGroup().addTo(map);

      // Store Location Marker
      const storeIcon = L.divIcon({
        className: 'store-custom-marker',
        html: `<div class="store-pin-inner"><span class="store-badge">HUB</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      L.marker(storeCoords, { icon: storeIcon })
        .addTo(map)
        .bindPopup(`<strong>Quickly Central Store / Hub</strong><br/>Lat: ${storeCoords[0]}, Lng: ${storeCoords[1]}`);

      mapInstanceRef.current = map;
    }

    return () => {
      // Cleanup on unmount handled by ref
    };
  }, [storeCoords]);

  // Handle map clicks for drawing and testing
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng;
      const roundedLat = Number(lat.toFixed(6));
      const roundedLng = Number(lng.toFixed(6));

      if (isDrawing) {
        setDrawPoints((prev) => [...prev, [roundedLat, roundedLng]]);
      } else if (isTestingLocation) {
        handleTestLocation([roundedLat, roundedLng]);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isDrawing, isTestingLocation, zones, riders, storeCoords]);

  // Render existing zones on map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = polygonsLayerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    zones.forEach((zone) => {
      if (!zone.polygon || zone.polygon.length < 3) return;

      const poly = L.polygon(zone.polygon, {
        color: zone.color || '#0c831f',
        weight: zone.is_active ? 2.5 : 1.5,
        dashArray: zone.is_active ? null : '6, 6',
        fillColor: zone.color || '#0c831f',
        fillOpacity: zone.is_active ? 0.22 : 0.08
      }).addTo(layerGroup);

      const center = calculatePolygonCenter(zone.polygon);

      // Tooltip & Popup
      poly.bindTooltip(`<strong>${zone.name}</strong><br/>SLA: ${zone.delivery_time_mins || 15} mins`, {
        permanent: false,
        sticky: true
      });

      poly.bindPopup(`
        <div style="font-family: inherit; min-width: 170px;">
          <h4 style="margin: 0 0 4px; color: ${zone.color};">${zone.name}</h4>
          <p style="margin: 0 0 4px; font-size: 12px; color: #64748b;">Code: <strong>${zone.code || 'N/A'}</strong></p>
          <p style="margin: 0 0 6px; font-size: 12px;">Delivery SLA: <strong>${zone.delivery_time_mins || 15} mins</strong></p>
          <p style="margin: 0; font-size: 12px;">Status: <span style="font-weight: 700; color: ${zone.is_active ? '#0c831f' : '#dc2626'};">${zone.is_active ? 'Active' : 'Paused'}</span></p>
        </div>
      `);

      // Centroid Label Badge
      const labelIcon = L.divIcon({
        className: 'zone-centroid-label',
        html: `<span style="border-color: ${zone.color}; color: ${zone.color};">${zone.name}</span>`,
        iconSize: [120, 24],
        iconAnchor: [60, 12]
      });
      L.marker(center, { icon: labelIcon, interactive: false }).addTo(layerGroup);
    });
  }, [zones]);

  // Render Drawing progress on map
  useEffect(() => {
    const layerGroup = drawLayerGroupRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();

    if (drawPoints.length === 0) return;

    // Draw vertex point markers
    drawPoints.forEach((pt, index) => {
      const pointIcon = L.divIcon({
        className: 'draw-point-marker',
        html: `<div class="draw-dot">${index + 1}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      L.marker(pt, { icon: pointIcon }).addTo(layerGroup);
    });

    // Draw line or polygon preview
    if (drawPoints.length > 2) {
      L.polygon(drawPoints, {
        color: zoneForm.color || '#0c831f',
        weight: 2,
        dashArray: '5, 5',
        fillColor: zoneForm.color || '#0c831f',
        fillOpacity: 0.15
      }).addTo(layerGroup);
    } else if (drawPoints.length === 2) {
      L.polyline(drawPoints, {
        color: zoneForm.color || '#0c831f',
        weight: 2,
        dashArray: '5, 5'
      }).addTo(layerGroup);
    }
  }, [drawPoints, zoneForm.color]);

  // Render live online riders on map
  useEffect(() => {
    const layerGroup = ridersLayerGroupRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();

    riders.forEach((rider) => {
      const lat = Number(rider.current_lat ?? rider.lat);
      const lng = Number(rider.current_lng ?? rider.lng);
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

      const isOnline = rider.is_online === true;
      const isBusy = !!rider.active_order_id;

      const riderIcon = L.divIcon({
        className: 'rider-custom-marker',
        html: `
          <div class="rider-dot-wrapper ${isOnline ? 'online' : 'offline'} ${isBusy ? 'busy' : 'idle'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18.5" cy="17.5" r="3.5"></circle>
              <circle cx="5.5" cy="17.5" r="3.5"></circle>
              <circle cx="15" cy="5" r="1"></circle>
              <path d="M12 17.5V14l-3-3 4-3 2 3h2"></path>
            </svg>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      // Find which zone this rider is inside
      const insideZone = zones.find(z => z.is_active && isPointInPolygon([lat, lng], z.polygon));

      L.marker([lat, lng], { icon: riderIcon })
        .addTo(layerGroup)
        .bindPopup(`
          <div style="font-family: inherit;">
            <h4 style="margin: 0 0 2px;">${rider.rider_name || rider.rider_code}</h4>
            <p style="margin: 0 0 4px; font-size: 11.5px; color: #64748b;">Code: <strong>${rider.rider_code}</strong></p>
            <p style="margin: 0 0 4px; font-size: 12px;">Status: <strong>${isBusy ? 'On Active Delivery' : 'Available & Idle'}</strong></p>
            <p style="margin: 0; font-size: 12px;">Current Zone: <strong style="color: ${insideZone ? insideZone.color : '#94a3b8'};">${insideZone ? insideZone.name : 'Unzoned Territory'}</strong></p>
          </div>
        `);
    });
  }, [riders, zones]);

  // Test Location Simulator
  const handleTestLocation = (coords) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (testMarkerRef.current) {
      testMarkerRef.current.remove();
    }

    const pinIcon = L.divIcon({
      className: 'test-custom-marker',
      html: `<div class="test-pin-pulse"></div><div class="test-pin-dot"></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    testMarkerRef.current = L.marker(coords, { icon: pinIcon }).addTo(map);

    // Mock order at this point to run polygon dispatch engine
    const mockOrder = {
      delivery_address: { lat: coords[0], lng: coords[1] }
    };

    const dispatchResult = rankRidersForOrder(mockOrder, riders, zones, storeCoords);
    setTestResult({
      coords,
      ...dispatchResult
    });
  };

  const handleStartDraw = () => {
    setDrawPoints([]);
    setIsDrawing(true);
    setIsTestingLocation(false);
    if (testMarkerRef.current) testMarkerRef.current.remove();
    setTestResult(null);
    showToast('Click on the map to place polygon points. Place at least 3 points.', 'info');
  };

  const handleUndoPoint = () => {
    setDrawPoints((prev) => prev.slice(0, -1));
  };

  const handleCancelDraw = () => {
    setDrawPoints([]);
    setIsDrawing(false);
  };

  const handleFinishDraw = () => {
    if (drawPoints.length < 3) {
      showToast('A polygon requires at least 3 points to form an enclosed delivery zone.', 'error');
      return;
    }

    const defaultName = `Zone ${zones.length + 1}`;
    const defaultCode = `ZN-${String(zones.length + 1).padStart(2, '0')}`;
    const defaultColor = PRESET_COLORS[zones.length % PRESET_COLORS.length];

    setZoneForm({
      id: `zone-${Date.now()}`,
      name: defaultName,
      code: defaultCode,
      color: defaultColor,
      delivery_time_mins: 15,
      min_order_value: 0,
      delivery_fee: 0,
      assigned_riders: [],
      is_active: true
    });

    setEditingZone(null);
    setIsModalOpen(true);
  };

  const handleEditZone = (zone) => {
    setZoneForm({
      ...zone
    });
    setEditingZone(zone);
    setDrawPoints([...zone.polygon]);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (zoneId) => {
    const updated = zones.map(z => z.id === zoneId ? { ...z, is_active: !z.is_active } : z);
    setZones(updated);
    try {
      await db.zones.save(updated);
      showToast('Delivery zone status updated', 'success');
    } catch (err) {
      showToast('Failed to save zone status: ' + err.message, 'error');
    }
  };

  const handleDeleteZone = async (zoneId) => {
    if (!window.confirm('Are you sure you want to delete this delivery zone?')) return;
    const updated = zones.filter(z => z.id !== zoneId);
    setZones(updated);
    try {
      await db.zones.save(updated);
      showToast('Delivery zone removed', 'success');
    } catch (err) {
      showToast('Failed to delete zone: ' + err.message, 'error');
    }
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!zoneForm.name.trim()) {
      showToast('Zone name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      let updatedZones = [];
      if (editingZone) {
        updatedZones = zones.map(z => z.id === editingZone.id ? { ...zoneForm, polygon: drawPoints } : z);
      } else {
        const newZone = {
          ...zoneForm,
          polygon: drawPoints,
          created_at: new Date().toISOString()
        };
        updatedZones = [...zones, newZone];
      }

      await db.zones.save(updatedZones);
      setZones(updatedZones);
      setIsModalOpen(false);
      setIsDrawing(false);
      setDrawPoints([]);
      setEditingZone(null);
      showToast('Delivery zone saved successfully!', 'success');
    } catch (err) {
      showToast('Failed to save zone: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFocusZone = (polygon) => {
    const map = mapInstanceRef.current;
    if (!map || !polygon || polygon.length === 0) return;
    const bounds = L.latLngBounds(polygon);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  };

  return (
    <div className="zones-page-container">
      {/* Top Header */}
      <div className="zones-header">
        <div>
          <div className="zones-title-row">
            <Layers className="zones-header-icon" />
            <h2>Delivery Zones & Polygon Logic</h2>
            <span className="zones-count-pill">{zones.length} Zones Active</span>
          </div>
          <p className="zones-subtitle">
            Define custom geographic polygons to route incoming customer orders to the optimal riders without boundary detour delays.
          </p>
        </div>

        <div className="zones-header-actions">
          {!isDrawing ? (
            <>
              <button 
                type="button" 
                className={`btn-action test-toggle-btn ${isTestingLocation ? 'active' : ''}`}
                onClick={() => {
                  setIsTestingLocation(!isTestingLocation);
                  setTestResult(null);
                  if (testMarkerRef.current) testMarkerRef.current.remove();
                }}
              >
                <Crosshair size={16} />
                <span>{isTestingLocation ? 'Exit Test Mode' : 'Test Address Drop'}</span>
              </button>

              <button 
                type="button" 
                className="btn-action draw-start-btn"
                onClick={handleStartDraw}
              >
                <Plus size={16} />
                <span>Draw New Zone</span>
              </button>
            </>
          ) : (
            <div className="drawing-toolbar">
              <span className="drawing-status-badge">
                <Edit3 size={14} /> Points: {drawPoints.length}
              </span>
              <button 
                type="button" 
                className="btn-draw-tool" 
                onClick={handleUndoPoint}
                disabled={drawPoints.length === 0}
                title="Undo point"
              >
                <RotateCcw size={14} /> Undo
              </button>
              <button 
                type="button" 
                className="btn-draw-tool cancel" 
                onClick={handleCancelDraw}
              >
                <X size={14} /> Cancel
              </button>
              <button 
                type="button" 
                className="btn-draw-tool save" 
                onClick={handleFinishDraw}
                disabled={drawPoints.length < 3}
              >
                <Check size={14} /> Done ({drawPoints.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Test Location Alert Banner */}
      {isTestingLocation && (
        <div className="test-location-banner">
          <div className="banner-left">
            <Info size={18} className="banner-icon" />
            <div>
              <strong>Interactive Simulation Mode Active</strong>
              <p>Click anywhere on the map to test which delivery polygon matches and see real-time rider ranking.</p>
            </div>
          </div>
          {testResult && (
            <div className="simulation-result-card">
              {testResult.matchedZone ? (
                <div className="result-pill matched" style={{ borderColor: testResult.matchedZone.color }}>
                  <Sparkles size={15} style={{ color: testResult.matchedZone.color }} />
                  <span>
                    Matched <strong>{testResult.matchedZone.name}</strong> ({testResult.matchedZone.delivery_time_mins} min SLA) &bull; Top Candidate: <strong>{testResult.rankedRiders[0]?.rider_code || 'None currently online'}</strong>
                  </span>
                </div>
              ) : (
                <div className="result-pill unzoned">
                  <AlertCircle size={15} color="#dc2626" />
                  <span>Outside defined polygons &bull; Falls back to nearest dark store rider</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Map Box */}
      <div className="zones-map-card">
        <div ref={mapContainerRef} className="zones-leaflet-map" />

        {/* Floating Map Legend */}
        <div className="map-legend-overlay">
          <h4>Map Legend</h4>
          <div className="legend-item">
            <span className="legend-icon-hub"></span>
            <span>Quickly Dark Store / Hub</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon-rider online"></span>
            <span>Online Rider GPS ({riders.filter(r => r.is_online).length} Active)</span>
          </div>
          <div className="legend-item">
            <span className="legend-icon-zone"></span>
            <span>Polygon Delivery Boundary</span>
          </div>
        </div>
      </div>

      {/* Zones List Grid */}
      <div className="zones-list-section">
        <div className="section-title-bar">
          <h3>Configured Delivery Zones ({zones.length})</h3>
          <span className="section-hint">Orders dropping inside these polygons prioritize local zone riders first.</span>
        </div>

        {zones.length === 0 ? (
          <div className="zones-empty-card">
            <Layers size={36} color="#94a3b8" />
            <h4>No Delivery Zones Created Yet</h4>
            <p>Click <strong>Draw New Zone</strong> above, click at least 3 points on the map to outline your service boundary, and save your first polygon.</p>
          </div>
        ) : (
          <div className="zones-cards-grid">
            {zones.map((zone) => {
              const insideRiders = riders.filter(r => {
                const lat = Number(r.current_lat ?? r.lat);
                const lng = Number(r.current_lng ?? r.lng);
                return !isNaN(lat) && !isNaN(lng) && isPointInPolygon([lat, lng], zone.polygon);
              });

              return (
                <div 
                  key={zone.id} 
                  className={`zone-card ${zone.is_active ? 'active' : 'paused'}`}
                  style={{ borderTop: `4px solid ${zone.color}` }}
                >
                  <div className="zone-card-top">
                    <div>
                      <div className="zone-name-row">
                        <span className="zone-color-swatch" style={{ background: zone.color }}></span>
                        <h4>{zone.name}</h4>
                      </div>
                      <span className="zone-code-tag">{zone.code || 'ZONE'}</span>
                    </div>

                    <div className="zone-toggle-wrap">
                      <button 
                        type="button"
                        className={`zone-toggle-btn ${zone.is_active ? 'on' : 'off'}`}
                        onClick={() => handleToggleActive(zone.id)}
                        title={zone.is_active ? 'Click to Pause Zone' : 'Click to Activate Zone'}
                      >
                        <span className="toggle-dot"></span>
                        <span className="toggle-text">{zone.is_active ? 'Active' : 'Paused'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="zone-meta-grid">
                    <div className="meta-box">
                      <span className="meta-label"><Clock size={12} /> Target SLA</span>
                      <span className="meta-value">{zone.delivery_time_mins || 15} Mins</span>
                    </div>
                    <div className="meta-box">
                      <span className="meta-label"><Bike size={12} /> Live Riders</span>
                      <span className="meta-value" style={{ color: insideRiders.length > 0 ? '#0c831f' : '#94a3b8' }}>
                        {insideRiders.length} in zone
                      </span>
                    </div>
                    <div className="meta-box">
                      <span className="meta-label"><MapPin size={12} /> Vertices</span>
                      <span className="meta-value">{zone.polygon?.length || 0} points</span>
                    </div>
                  </div>

                  <div className="zone-card-footer">
                    <button 
                      type="button" 
                      className="btn-zone-action focus" 
                      onClick={() => handleFocusZone(zone.polygon)}
                      title="Fly to Zone"
                    >
                      <Navigation size={13} /> View on Map
                    </button>
                    <button 
                      type="button" 
                      className="btn-zone-action edit" 
                      onClick={() => handleEditZone(zone)}
                      title="Edit Zone"
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    <button 
                      type="button" 
                      className="btn-zone-action delete" 
                      onClick={() => handleDeleteZone(zone.id)}
                      title="Delete Zone"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal for Creating / Editing Zone Details */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="zone-modal-box">
            <div className="zone-modal-header">
              <h3>{editingZone ? 'Edit Delivery Zone' : 'Save New Delivery Zone'}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModal}>
              <div className="form-group">
                <label>Zone Name *</label>
                <input 
                  type="text" 
                  value={zoneForm.name} 
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} 
                  placeholder="e.g., Jangipur Core & Market Area"
                  required 
                />
              </div>

              <div className="form-row-two">
                <div className="form-group">
                  <label>Zone Code</label>
                  <input 
                    type="text" 
                    value={zoneForm.code} 
                    onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })} 
                    placeholder="e.g., ZN-01" 
                  />
                </div>

                <div className="form-group">
                  <label>Guaranteed SLA (Minutes)</label>
                  <input 
                    type="number" 
                    min="5" 
                    max="60" 
                    value={zoneForm.delivery_time_mins} 
                    onChange={(e) => setZoneForm({ ...zoneForm, delivery_time_mins: Number(e.target.value) })} 
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Polygon Color Theme</label>
                <div className="color-presets-row">
                  {PRESET_COLORS.map(c => (
                    <button 
                      key={c} 
                      type="button" 
                      className={`color-preset-circle ${zoneForm.color === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setZoneForm({ ...zoneForm, color: c })}
                    />
                  ))}
                  <input 
                    type="color" 
                    value={zoneForm.color} 
                    onChange={(e) => setZoneForm({ ...zoneForm, color: e.target.value })} 
                    className="custom-color-picker" 
                    title="Custom Color"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Assigned Priority Riders (Optional)</label>
                <p className="form-input-hint">Riders assigned here get dispatch priority even when positioned near the zone border.</p>
                <div className="riders-select-grid">
                  {riders.map(r => {
                    const isSelected = Array.isArray(zoneForm.assigned_riders) && zoneForm.assigned_riders.includes(r.rider_code);
                    return (
                      <label key={r.rider_code} className={`rider-select-pill ${isSelected ? 'selected' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={(e) => {
                            const cur = zoneForm.assigned_riders || [];
                            if (e.target.checked) {
                              setZoneForm({ ...zoneForm, assigned_riders: [...cur, r.rider_code] });
                            } else {
                              setZoneForm({ ...zoneForm, assigned_riders: cur.filter(c => c !== r.rider_code) });
                            }
                          }}
                        />
                        <span>{r.rider_name || r.rider_code}</span>
                      </label>
                    );
                  })}
                  {riders.length === 0 && (
                    <span style={{ fontSize: '12px', color: '#64748b' }}>No riders registered in system yet.</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={zoneForm.is_active} 
                    onChange={(e) => setZoneForm({ ...zoneForm, is_active: e.target.checked })} 
                  />
                  <span>Active &amp; Ready for Order Routing</span>
                </label>
              </div>

              <div className="modal-actions-row">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Delivery Zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
