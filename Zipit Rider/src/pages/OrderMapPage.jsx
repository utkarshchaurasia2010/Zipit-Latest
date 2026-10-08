import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, db } from '../services/db';
import { ArrowLeft, Navigation, CheckCircle2, Phone, PackageOpen, QrCode, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import SlideToAccept from '../components/SlideToAccept';
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

const storeLocation = [25.5788, 83.5780]; // Mock store location

export default function OrderMapPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [myLocation, setMyLocation] = useState(storeLocation);
  const [showUpiQr, setShowUpiQr] = useState(false);
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
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" maxZoom={19} />
          
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

          <Polyline positions={[myLocation, destLocation]} color="#2563eb" weight={5} opacity={0.8} dashArray="8, 10" />
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
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <SlideToAccept
              onAccept={() => handleUpdateStatus('Delivered')}
              label="Slide to Mark Delivered"
            />

            <button 
              onClick={() => setShowUpiQr(true)}
              style={{
                width: '100%',
                background: '#ecfdf5',
                color: '#047857',
                border: '1.5px solid #a7f3d0',
                padding: '12px',
                borderRadius: '14px',
                fontWeight: '800',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <QrCode size={18} /> Show Doorstep UPI QR (₹{order.total})
            </button>
          </div>
        )}
      </div>

      {/* Doorstep UPI QR Modal in Map View */}
      {showUpiQr && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 9999
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '24px 20px',
            width: '100%',
            maxWidth: '350px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setShowUpiQr(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} color="#475569" />
            </button>

            <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              ⚡ Doorstep Payment Collection
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px' }}>
              Order #{order.id.slice(0, 6).toUpperCase()}
            </h2>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#15803d', margin: '8px 0 16px' }}>
              ₹{order.total}
            </div>

            <div style={{
              background: '#f8fafc',
              border: '2px solid #e2e8f0',
              borderRadius: '16px',
              padding: '16px',
              display: 'inline-block',
              marginBottom: '16px'
            }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(`upi://pay?pa=7290886111@ptyes&pn=Zipit%20Store&am=${order.total}&cu=INR&tn=Order%20${order.id.slice(0,6)}`)}`}
                alt="UPI QR Code"
                style={{ width: '180px', height: '180px', display: 'block' }}
              />
            </div>

            <p style={{ fontSize: '13px', color: '#475569', fontWeight: '600', margin: '0 0 16px', lineHeight: 1.4 }}>
              Customer can scan with GPay, PhonePe, or Paytm
            </p>

            <button
              onClick={() => {
                setShowUpiQr(false);
                handleUpdateStatus('Delivered');
              }}
              style={{
                width: '100%',
                background: '#15803d',
                color: '#ffffff',
                border: 'none',
                padding: '14px',
                borderRadius: '14px',
                fontWeight: '800',
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              Payment Collected · Mark Delivered
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
