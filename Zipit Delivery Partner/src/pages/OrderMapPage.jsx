import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, db } from '../services/db';
import { ArrowLeft, Navigation, CheckCircle2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet Default Icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const storeLocation = [25.5788, 83.5780]; // Mock store location

export default function OrderMapPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [myLocation, setMyLocation] = useState(storeLocation);
  const watchIdRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    fetchOrder();

    // Start watching position
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setMyLocation([lat, lng]);
          // Sync location to Supabase
          if (id) {
            db.orders.updateLocation(id, lat, lng);
          }
        },
        (err) => console.warn('Geolocation Error:', err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [id]);

  const fetchOrder = async () => {
    const { data } = await supabase.from('orders').select('*').eq('id', id).single();
    setOrder(data);
  };

  const handleUpdateStatus = async (status) => {
    await db.orders.updateStatus(id, status);
    fetchOrder();
    if (status === 'Delivered') {
      alert('Order Delivered!');
      navigate('/');
    }
  };

  if (!order) {
    return <div style={{ padding: '24px', textAlign: 'center' }}>Loading Order...</div>;
  }

  const destLocation = [
    Number(order.delivery_address?.lat) || 25.5900,
    Number(order.delivery_address?.lng) || 83.5850
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      <header style={{ padding: '16px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft size={24} color="#1e293b" />
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Order #{order.id.slice(0,6)}</h1>
      </header>

      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer 
          center={myLocation} 
          zoom={15} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
          ref={mapRef}
        >
          <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
          
          <Marker position={storeLocation} />
          <Marker position={destLocation} />
          
          {/* Driver Marker (Blinking Dot) */}
          <Marker 
            position={myLocation} 
            icon={L.divIcon({
              className: 'driver-marker',
              html: `<div style="width: 16px; height: 16px; background: #3b82f6; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })} 
          />

          <Polyline positions={[myLocation, destLocation]} color="#3b82f6" weight={4} dashArray="8, 8" />
        </MapContainer>
        
        <button 
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.setView(myLocation, 16);
            }
          }}
          style={{ position: 'absolute', bottom: '24px', right: '16px', zIndex: 1000, background: '#fff', padding: '12px', borderRadius: '50%', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', cursor: 'pointer' }}
        >
          <Navigation size={24} color="#3b82f6" />
        </button>
      </div>

      <div style={{ padding: '24px', background: '#fff', borderTop: '1px solid #e2e8f0', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', marginTop: '-24px', zIndex: 1000, position: 'relative', boxShadow: '0 -4px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Customer Address</div>
        <div style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.5', marginBottom: '24px' }}>
          {order.delivery_address?.details?.split('\n---TAG:')[0] || 'Unknown Address'}
          {order.delivery_address?.phone && <div style={{ marginTop: '4px', fontWeight: '700', color: '#0f172a' }}>Phone: {order.delivery_address.phone}</div>}
        </div>

        {order.status === 'Preparing' && (
          <button 
            onClick={() => handleUpdateStatus('Out for Delivery')}
            style={{ width: '100%', background: '#F8CB46', color: '#000', padding: '16px', borderRadius: '12px', border: 'none', fontWeight: '800', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            Mark Out for Delivery
          </button>
        )}
        {order.status === 'Out for Delivery' && (
          <button 
            onClick={() => handleUpdateStatus('Delivered')}
            style={{ width: '100%', background: '#22c55e', color: '#fff', padding: '16px', borderRadius: '12px', border: 'none', fontWeight: '800', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <CheckCircle2 size={20} />
            Mark Delivered
          </button>
        )}
      </div>
    </div>
  );
}
