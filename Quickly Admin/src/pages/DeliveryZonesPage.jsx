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
  RotateCcw, 
  Info, 
  Crosshair,
  Sparkles,
  AlertCircle,
  Search,
  Eye,
  Loader2
} from 'lucide-react';
import { db, supabase } from '../services/db';
import { isPointInPolygon, calculatePolygonCenter, getDistanceMeters, rankRidersForOrder } from '../utils/geoZones';
import { useToast } from '../context/ToastContext';
import './DeliveryZonesPage.css';

// Official Google Maps API Key used in Quickly Customer App & Rider App
export const DEFAULT_GOOGLE_MAPS_KEY = 'AIzaSyA_pq9MB8GYWB6b03uAL4Ej7Cu6CatewmM';

export const getStoredGoogleMapsKey = () => {
  return localStorage.getItem('zipit_google_maps_key') || 
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 
    DEFAULT_GOOGLE_MAPS_KEY;
};

// Dynamically load Google Maps Places SDK
export const loadGoogleMapsSDK = (key) => {
  const activeKey = key || getStoredGoogleMapsKey();
  if (!activeKey) return Promise.resolve(false);
  if (typeof window !== 'undefined' && window.google?.maps?.places) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(false);
    const existing = document.getElementById('zipit-admin-gmaps-script');
    if (existing) {
      if (window.google?.maps?.places) return resolve(true);
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'zipit-admin-gmaps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${activeKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('Google Maps SDK load error');
      resolve(false);
    };
    document.head.appendChild(script);
  });
};

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
  const tileLayerRef = useRef(null);
  const polygonsLayerGroupRef = useRef(null);
  const drawLayerGroupRef = useRef(null);
  const testMarkerRef = useRef(null);
  const ridersLayerGroupRef = useRef(null);

  const [zones, setZones] = useState([]);
  const [riders, setRiders] = useState([]);
  const [registeredRiders, setRegisteredRiders] = useState([]);
  const [storeCoords, setStoreCoords] = useState([25.6744, 83.4985]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Map view style: 'google-streets' | 'google-hybrid'
  const [mapStyle, setMapStyle] = useState('google-hybrid'); // Default to high-detail satellite view

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

  // Landmark / Address Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  const { showToast } = useToast();

  // Load Google Maps SDK, zones, store coordinates, and verified registered riders
  useEffect(() => {
    loadGoogleMapsSDK();
    loadData();

    // Realtime synchronization when riders change status or register
    const channel = supabase
      .channel('delivery-zones-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_codes' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_status' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      // 2. Load strictly verified registered delivery riders from access_codes
      const { data: partnerCodes, error: codesErr } = await supabase
        .from('access_codes')
        .select('*')
        .eq('role', 'rider')
        .order('name', { ascending: true });

      if (codesErr) console.warn('Could not load access_codes:', codesErr);

      const isApplication = (item) => {
        return (item.code && item.code.startsWith('APP-')) || 
               (item.label && (item.label.includes('Application') || item.label.includes('Pending')));
      };

      // Filter only real, approved delivery riders (exclude shopkeepers and pending applications)
      const verifiedRiders = (partnerCodes || []).filter(c => !isApplication(c) && c.role === 'rider');

      // 3. Load live rider statuses (GPS & online state)
      const { data: statusRows } = await supabase.from('rider_status').select('*');
      const statusMap = new Map((statusRows || []).map(s => [s.rider_code, s]));

      // Merge verified riders with their real-time telemetry (strictly excludes fake seed IDs and shopkeepers)
      const verifiedRidersWithStatus = verifiedRiders.map(vr => {
        const liveStatus = statusMap.get(vr.code);
        return {
          rider_code: vr.code,
          rider_name: vr.name || vr.code,
          phone: vr.mobile || '',
          vehicle_no: vr.vehicle_no || '',
          is_active_partner: vr.is_active !== false,
          is_online: liveStatus?.is_online === true,
          current_lat: liveStatus?.current_lat ?? liveStatus?.lat ?? null,
          current_lng: liveStatus?.current_lng ?? liveStatus?.lng ?? null,
          active_order_id: liveStatus?.active_order_id ?? null,
          last_ping: liveStatus?.last_ping ?? null
        };
      });

      setRegisteredRiders(verifiedRiders);
      setRiders(verifiedRidersWithStatus);
    } catch (err) {
      console.error('Failed to load delivery zones data:', err);
      showToast('Error loading delivery zones', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Initialize Leaflet map with Official Google Maps Tiles
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: storeCoords,
        zoom: 14,
        zoomControl: true,
        attributionControl: false
      });

      // Official Google Maps Tile Layer with multi-subdomain parallelism
      const initialTileUrl = mapStyle === 'google-hybrid'
        ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

      const tileLayer = L.tileLayer(initialTileUrl, {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
        updateWhenIdle: false,
        updateWhenZooming: true,
        keepBuffer: 4
      }).addTo(map);

      tileLayerRef.current = tileLayer;

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
      // Map cleanup on unmount handled by ref
    };
  }, [storeCoords]);

  // Switch between Google Hybrid (Satellite + Roads) and Google Streets without reloading
  const handleToggleMapStyle = () => {
    const nextStyle = mapStyle === 'google-streets' ? 'google-hybrid' : 'google-streets';
    setMapStyle(nextStyle);
    if (tileLayerRef.current) {
      const nextUrl = nextStyle === 'google-hybrid'
        ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      tileLayerRef.current.setUrl(nextUrl);
    }
  };

  // Google Places Autocomplete search
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const activeKey = getStoredGoogleMapsKey();
      try {
        if (window.google?.maps?.places?.AutocompleteService) {
          const service = new window.google.maps.places.AutocompleteService();
          service.getPlacePredictions({
            input: query,
            componentRestrictions: { country: 'in' },
            locationBias: new window.google.maps.Circle({
              center: { lat: storeCoords[0], lng: storeCoords[1] },
              radius: 30000
            })
          }, (predictions, status) => {
            setIsSearching(false);
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
              setSearchResults(predictions.map(p => ({
                description: p.description,
                place_id: p.place_id,
                main_text: p.structured_formatting?.main_text || p.description
              })));
            } else {
              setSearchResults([]);
            }
          });
        } else {
          // Fallback REST endpoint
          const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${activeKey}`);
          if (res.ok) {
            const data = await res.json();
            const results = (data.results || []).slice(0, 5).map(r => ({
              description: r.formatted_address,
              place_id: r.place_id,
              main_text: r.address_components?.[0]?.long_name || r.formatted_address,
              location: r.geometry?.location
            }));
            setSearchResults(results);
          }
          setIsSearching(false);
        }
      } catch (err) {
        console.warn('Search place error:', err);
        setIsSearching(false);
      }
    }, 350);
  };

  const handleSelectPlace = (place) => {
    setSearchQuery(place.main_text || place.description);
    setSearchResults([]);
    const activeKey = getStoredGoogleMapsKey();

    if (place.location && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([place.location.lat, place.location.lng], 16, { animate: true });
      return;
    }

    if (window.google?.maps?.places?.PlacesService && mapInstanceRef.current) {
      const dummy = document.createElement('div');
      const service = new window.google.maps.places.PlacesService(dummy);
      service.getDetails({ placeId: place.place_id, fields: ['geometry'] }, (res, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && res?.geometry?.location) {
          mapInstanceRef.current.flyTo([res.geometry.location.lat(), res.geometry.location.lng()], 16, { animate: true });
        }
      });
    } else {
      fetch(`https://maps.googleapis.com/maps/api/geocode/json?place_id=${place.place_id}&key=${activeKey}`)
        .then(r => r.json())
        .then(d => {
          const loc = d.results?.[0]?.geometry?.location;
          if (loc && mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([loc.lat, loc.lng], 16, { animate: true });
          }
        })
        .catch(() => {});
    }
  };

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
        fillOpacity: zone.is_active ? 0.25 : 0.08
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
        html: `<span style="border-color: ${zone.color}; color: ${zone.color}; background: rgba(0,0,0,0.7);">${zone.name}</span>`,
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
        weight: 2.5,
        dashArray: '5, 5',
        fillColor: zoneForm.color || '#0c831f',
        fillOpacity: 0.22
      }).addTo(layerGroup);
    } else if (drawPoints.length === 2) {
      L.polyline(drawPoints, {
        color: zoneForm.color || '#0c831f',
        weight: 2.5,
        dashArray: '5, 5'
      }).addTo(layerGroup);
    }
  }, [drawPoints, zoneForm.color]);

  // Render live online riders on map (Blinkit style rider on bike marker)
  useEffect(() => {
    const layerGroup = ridersLayerGroupRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();

    // Strictly show only registered online delivery riders
    const onlineRiders = riders.filter(r => r.is_online);

    onlineRiders.forEach((rider, idx) => {
      let lat = Number(rider.current_lat ?? rider.lat);
      let lng = Number(rider.current_lng ?? rider.lng);

      const hasRealGPS = !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
      if (!hasRealGPS) {
        // Position online rider near Central Hub with slight spread if GPS not yet pinged
        lat = storeCoords[0] + 0.0007 * (idx + 1);
        lng = storeCoords[1] + 0.0007 * (idx + 1);
      }

      const isBusy = !!rider.active_order_id;
      const firstName = rider.rider_name ? rider.rider_name.split(' ')[0] : rider.rider_code;

      const riderIcon = L.divIcon({
        className: 'blinkit-rider-marker-container',
        html: `
          <div class="blinkit-rider-wrapper ${isBusy ? 'busy' : 'online'}">
            <div class="blinkit-rider-tag">
              <span class="rider-live-dot"></span>
              <span class="rider-name-label">${firstName}</span>
            </div>
            <div class="blinkit-bike-circle">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18.5" cy="17.5" r="3.5"></circle>
                <circle cx="5.5" cy="17.5" r="3.5"></circle>
                <circle cx="15" cy="5" r="1.5" fill="currentColor"></circle>
                <path d="M12 17.5V14l-3-3 4-3 2 3h3"></path>
                <rect x="7" y="6" width="3" height="4" rx="1" fill="currentColor"></rect>
              </svg>
            </div>
            <div class="blinkit-marker-pulse"></div>
          </div>
        `,
        iconSize: [46, 56],
        iconAnchor: [23, 50]
      });

      // Find which zone this rider is inside
      const insideZone = zones.find(z => z.is_active && isPointInPolygon([lat, lng], z.polygon));

      L.marker([lat, lng], { icon: riderIcon })
        .addTo(layerGroup)
        .bindPopup(`
          <div style="font-family: inherit; min-width: 170px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
              <h4 style="margin: 0; font-size: 13.5px; font-weight: 700;">${rider.rider_name || rider.rider_code}</h4>
            </div>
            <p style="margin: 0 0 3px; font-size: 11.5px; color: #64748b;">Code: <strong>${rider.rider_code}</strong></p>
            ${rider.vehicle_no ? `<p style="margin: 0 0 3px; font-size: 11.5px; color: #64748b;">Vehicle: <strong>${rider.vehicle_no}</strong></p>` : ''}
            <p style="margin: 0 0 3px; font-size: 12px;">Status: <strong style="color: ${isBusy ? '#f59e0b' : '#10b981'};">${isBusy ? 'On Delivery' : 'Online & Available'}</strong></p>
            <p style="margin: 0 0 3px; font-size: 11.5px; color: #64748b;">Telemetry: <strong>${hasRealGPS ? 'Live GPS Beacon' : 'Active at Store Hub'}</strong></p>
            <p style="margin: 0; font-size: 12px;">Delivery Zone: <strong style="color: ${insideZone ? insideZone.color : '#94a3b8'};">${insideZone ? insideZone.name : 'Outside Zones'}</strong></p>
          </div>
        `);
    });
  }, [riders, zones, storeCoords]);

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
    const validCodes = new Set(riders.map(r => r.rider_code));
    const cleanAssigned = (zone.assigned_riders || []).filter(c => validCodes.has(c));
    setZoneForm({
      ...zone,
      assigned_riders: cleanAssigned
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
            <h2>Delivery Zones &amp; Polygon Logic</h2>
            <span className="zones-count-pill">{zones.length} Zones Active</span>
          </div>
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
                className={`btn-draw-tool ${mapStyle === 'google-hybrid' ? 'satellite-active' : ''}`}
                onClick={handleToggleMapStyle}
                title="Toggle Satellite while drawing"
              >
                <Eye size={13} /> {mapStyle === 'google-hybrid' ? 'Satellite' : 'Streets'}
              </button>
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

      {/* Main Map Box with Floating Controls */}
      <div className="zones-map-card">
        <div ref={mapContainerRef} className="zones-leaflet-map" />

        {/* Floating Google Places Landmark Search */}
        <div className="map-search-overlay">
          <div className="map-search-input-wrap">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search area, landmark or street (e.g. Jangipur, Lanka)..." 
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {isSearching && <Loader2 size={16} className="search-spinner animate-spin" />}
            {searchQuery && !isSearching && (
              <X size={16} className="search-clear" onClick={() => { setSearchQuery(''); setSearchResults([]); }} />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="search-results-dropdown">
              {searchResults.map((res, i) => (
                <div key={i} className="search-result-row" onClick={() => handleSelectPlace(res)}>
                  <MapPin size={14} className="result-icon" />
                  <div>
                    <strong>{res.main_text}</strong>
                    <span>{res.description}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Floating View Switcher on Map */}
        <div className="map-controls-floating">
          <button 
            type="button" 
            className={`map-floating-style-btn ${mapStyle === 'google-hybrid' ? 'active-sat' : ''}`}
            onClick={handleToggleMapStyle}
            title={mapStyle === 'google-hybrid' ? 'Switch to Street Map' : 'Switch to High-Res Google Satellite View'}
          >
            <Layers size={16} />
            <span>{mapStyle === 'google-hybrid' ? '🛰️ Satellite' : '🗺️ Streets'}</span>
          </button>
        </div>

        {/* Floating Map Legend */}
        <div className="map-legend-overlay">
          <h4>Google Maps Layers</h4>
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
            <span>Polygon Boundary</span>
          </div>
        </div>
      </div>

      {/* Zones List Section */}
      <div className="zones-list-section">
        <div className="section-title-bar">
          <h3>Configured Delivery Zones ({zones.length})</h3>
        </div>

        {zones.length === 0 ? (
          <div className="zones-empty-card">
            <Layers size={36} color="#94a3b8" />
            <h4>No Delivery Zones Created Yet</h4>
            <p>Click <strong>Draw New Zone</strong> above, click at least 3 points on the satellite map to outline your service boundary, and save your first polygon.</p>
          </div>
        ) : (
          <div className="zones-cards-grid">
            {zones.map((zone) => {
              const validRiderCodes = new Set(riders.map(r => r.rider_code));
              const validAssignedRiders = (zone.assigned_riders || []).filter(c => validRiderCodes.has(c));

              // Compute online riders in this zone (inside polygon OR assigned to zone)
              const zoneOnlineRiders = riders.filter(r => {
                if (!r.is_online) return false;
                const lat = Number(r.current_lat ?? r.lat);
                const lng = Number(r.current_lng ?? r.lng);
                const isInside = !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0) && isPointInPolygon([lat, lng], zone.polygon);
                const isAssigned = validAssignedRiders.includes(r.rider_code);
                return isInside || isAssigned;
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
                      <span className="meta-label"><Bike size={12} /> Online Riders</span>
                      <span className="meta-value" style={{ color: zoneOnlineRiders.length > 0 ? '#0c831f' : '#94a3b8' }}>
                        {zoneOnlineRiders.length} Active
                      </span>
                    </div>
                    <div className="meta-box">
                      <span className="meta-label"><MapPin size={12} /> Vertices</span>
                      <span className="meta-value">{zone.polygon?.length || 0} points</span>
                    </div>
                  </div>

                  {/* Online Riders Live List */}
                  <div className="zone-online-riders-row">
                    <div className="zone-row-label">
                      <span className="online-live-beacon"></span>
                      <span>Online Riders ({zoneOnlineRiders.length})</span>
                    </div>
                    <div className="zone-riders-badges-wrap">
                      {zoneOnlineRiders.length > 0 ? (
                        zoneOnlineRiders.map(r => (
                          <span key={r.rider_code} className="zone-rider-live-chip" title={`${r.rider_name} (${r.rider_code})`}>
                            <span className="rider-live-pulse-dot" />
                            <Bike size={12} />
                            <span className="rider-chip-name">{r.rider_name || r.rider_code}</span>
                            {r.vehicle_no && <span className="rider-chip-veh">{r.vehicle_no}</span>}
                          </span>
                        ))
                      ) : (
                        <span className="zone-no-riders-text">No riders currently online in this zone</span>
                      )}
                    </div>
                  </div>

                  {/* Priority Assigned Riders (Strictly registered verified partners) */}
                  {validAssignedRiders.length > 0 && (
                    <div className="zone-assigned-row">
                      <span className="zone-assigned-title">Assigned Priority Riders:</span>
                      <div className="zone-assigned-tags">
                        {validAssignedRiders.map(code => {
                          const rMatch = riders.find(r => r.rider_code === code);
                          return (
                            <span key={code} className="zone-assigned-pill">
                              <span className={`status-mini-dot ${rMatch?.is_online ? 'online' : 'offline'}`} />
                              <span>{rMatch?.rider_name || code}</span>
                              {rMatch?.is_online && <span className="live-text-tag">LIVE</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

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
                <div className="riders-header-row">
                  <label>Assigned Priority Delivery Riders (Optional)</label>
                  <span className="riders-count-badge">
                    {riders.length} Registered Rider{riders.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="riders-select-grid">
                  {riders.map(r => {
                    const isSelected = Array.isArray(zoneForm.assigned_riders) && zoneForm.assigned_riders.includes(r.rider_code);
                    return (
                      <label key={r.rider_code} className={`rider-select-card ${isSelected ? 'selected' : ''}`}>
                        <div className="rider-card-checkbox">
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
                        </div>
                        <div className="rider-card-info">
                          <div className="rider-card-name-row">
                            <span className="rider-card-name">{r.rider_name || r.rider_code}</span>
                            <span className="rider-badge-code">{r.rider_code}</span>
                          </div>
                          <div className="rider-card-sub">
                            {r.vehicle_no && <span className="rider-chip-vehicle">{r.vehicle_no}</span>}
                            {r.phone && <span className="rider-chip-phone">{r.phone}</span>}
                            <span className={`rider-status-dot-wrap ${r.is_online ? 'online' : 'offline'}`}>
                              <span className="rider-status-dot"></span>
                              <span className="rider-status-text">{r.is_online ? 'Online' : 'Offline'}</span>
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                  {riders.length === 0 && (
                    <div className="no-riders-found">
                      <AlertCircle size={15} />
                      <span>No registered delivery riders found in database. Create or approve rider accounts under Partner Codes first.</span>
                    </div>
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
