import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, db } from '../services/db';
import { ArrowLeft, Navigation, CheckCircle2, Phone, PackageOpen } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Crisp SVG Icons
const createSvgIcon = (svgContent, width = 36, height = 36) => {
  return new L.DivIcon({
    className: 'custom-map-icon',
    html: `<div style="width: ${width}px; height: ${height}px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25)); display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);">${svgContent}</div>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2]
  });
};

const storeIcon = createSvgIcon(`
  <div style="background: #0c831f; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #ffffff;">
    <span style="font-size: 18px;">🏪</span>
  </div>
`, 34, 34);

const destIcon = createSvgIcon(`
  <div style="background: #ef4444; width: 36px; height: 36px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff;">
    <div style="transform: rotate(45deg); font-size: 16px;">🏠</div>
  </div>
`, 36, 36);

const OLA_MAPS_API_KEY = 'cb1_4fid_1_1354e75ad3dae085ce92fc8f';
const storeLocation = [25.5788, 83.5780]; // Store location

export default function OrderMapPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [myLocation, setMyLocation] = useState(storeLocation);
  const [routePolyline, setRoutePolyline] = useState(null);
  const watchIdRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    fetchOrder();

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setMyLocation([lat, lng]);
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

  useEffect(() => {
    const fetchDirections = async () => {
      if (!order || !order.delivery_address) return;
      const destLat = Number(order.delivery_address?.lat) || 25.5900;
      const destLng = Number(order.delivery_address?.lng) || 83.5850;
      try {
        const url = `https://api.olamaps.io/routing/v1/directions?origin=${myLocation[0]},${myLocation[1]}&destination=${destLat},${destLng}&api_key=${OLA_MAPS_API_KEY}`;
        const res = await fetch(url, { method: 'POST' });
        const data = await res.json();
        if (data && data.routes && data.routes[0]) {
          const legs = data.routes[0].legs || [];
          const points = [];
          legs.forEach(leg => {
            (leg.steps || []).forEach(step => {
              if (step.start_location) points.push([step.start_location.lat, step.start_location.lng]);
              if (step.end_location) points.push([step.end_location.lat, step.end_location.lng]);
            });
          });
          if (points.length > 0) {
            setRoutePolyline(points);
          }
        }
      } catch (e) {
        console.warn('Ola Maps directions fallback:', e);
      }
    };
    fetchDirections();
  }, [order, myLocation[0], myLocation[1]]);

  const fetchOrder = async () => {
    const { data } = await supabase.from('orders').select('*').eq('id', id).single();
    setOrder(data);
  };

  const handleUpdateStatus = async (status) => {
    await db.orders.updateStatus(id, status);
    fetchOrder();
    if (status === 'Delivered') {
      navigate('/');
    }
  };

  if (!order) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--color-bg)' }}>
        <div style={{ fontWeight: '600', color: 'var(--color-text-light)' }}>Loading Map...</div>
      </div>
    );
  }

  const destLocation = [
    Number(order.delivery_address?.lat) || 25.5900,
    Number(order.delivery_address?.lng) || 83.5850
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg)', position: 'relative' }}>
      
      {/* Floating Top Header */}
      <div style={{ 
        position: 'absolute', 
        top: '16px', 
        left: '16px', 
        right: '16px', 
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <button 
          onClick={() => navigate('/')} 
          style={{ 
            background: 'var(--color-surface)', 
            border: 'none', 
            cursor: 'pointer', 
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
        >
          <ArrowLeft size={24} color="var(--color-text)" />
        </button>
        <div style={{ 
          background: 'var(--color-surface)', 
          padding: '12px 20px', 
          borderRadius: '100px', 
          fontWeight: '700', 
          color: 'var(--color-text)', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          flex: 1,
          textAlign: 'center'
        }}>
          Order #{order.id.slice(0,6).toUpperCase()}
        </div>
      </div>

      {/* Map View */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer 
          center={myLocation} 
          zoom={15} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
          ref={mapRef}
        >
          <TileLayer 
            url="https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" 
            subdomains={['0', '1', '2', '3']}
            maxZoom={20} 
          />
          
          <Marker position={storeLocation} icon={storeIcon} />
          <Marker position={destLocation} icon={destIcon} />
          
          <Marker 
            position={myLocation} 
            icon={L.divIcon({
              className: 'driver-marker',
              html: `<div style="width: 20px; height: 20px; background: #2563eb; border: 4px solid #fff; border-radius: 50%; box-shadow: 0 0 16px rgba(37, 99, 235, 0.6);"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })} 
          />

          <Polyline positions={routePolyline || [myLocation, destLocation]} color="#2563eb" weight={5} opacity={0.8} dashArray={routePolyline ? undefined : "8, 10"} />
        </MapContainer>
        
        {/* Recenter Button */}
        <button 
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.flyTo(myLocation, 16, { animate: true });
            }
          }}
          style={{ 
            position: 'absolute', 
            bottom: '24px', 
            right: '16px', 
            zIndex: 1000, 
            background: 'var(--color-surface)', 
            width: '56px',
            height: '56px', 
            borderRadius: '50%', 
            border: 'none', 
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Navigation size={26} color="#2563eb" />
        </button>
      </div>

      {/* Bottom Action Sheet */}
      <div style={{ 
        background: 'var(--color-surface)', 
        borderTopLeftRadius: '32px', 
        borderTopRightRadius: '32px', 
        marginTop: '-32px', 
        zIndex: 1000, 
        position: 'relative', 
        boxShadow: '0 -8px 24px rgba(0,0,0,0.08)',
        padding: '24px 24px 32px 24px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Drag Handle */}
        <div style={{ width: '40px', height: '5px', background: 'var(--color-border)', borderRadius: '10px', margin: '0 auto 20px' }} />

        {/* Customer Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Deliver To
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-text)', lineHeight: '1.4', paddingRight: '16px' }}>
              {order.delivery_address?.details?.split('\n---TAG:')[0] || 'Customer Address'}
            </div>
          </div>
          
          {order.delivery_address?.phone && (
            <a href={`tel:${order.delivery_address.phone}`} style={{
              background: '#eff6ff',
              color: '#2563eb',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              textDecoration: 'none'
            }}>
              <Phone size={22} />
            </a>
          )}
        </div>

        {/* Action Button */}
        {order.status !== 'Out for Delivery' && order.status !== 'Delivered' && order.status !== 'Cancelled' && (
          <button 
            onClick={() => handleUpdateStatus('Out for Delivery')}
            style={{ 
              width: '100%', 
              background: 'var(--color-primary)', 
              color: '#000', 
              padding: '18px', 
              borderRadius: '16px', 
              border: 'none', 
              fontWeight: '800', 
              fontSize: '17px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '10px',
              boxShadow: '0 8px 20px rgba(248, 203, 70, 0.3)'
            }}
          >
            <PackageOpen size={22} />
            Pick Up Order & Start Delivery
          </button>
        )}
        
        {order.status === 'Out for Delivery' && (
          <button 
            onClick={() => handleUpdateStatus('Delivered')}
            style={{ 
              width: '100%', 
              background: 'var(--color-success)', 
              color: '#fff', 
              padding: '18px', 
              borderRadius: '16px', 
              border: 'none', 
              fontWeight: '800', 
              fontSize: '17px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '10px',
              boxShadow: '0 8px 20px rgba(34, 197, 94, 0.3)'
            }}
          >
            <CheckCircle2 size={24} />
            Slide to Mark Delivered
          </button>
        )}
      </div>
    </div>
  );
}
