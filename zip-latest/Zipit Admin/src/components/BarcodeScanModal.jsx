import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, Barcode, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function BarcodeScanModal({ isOpen, onClose, onDetected }) {
  const [errorMsg, setErrorMsg] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualCode, setManualCode] = useState('');
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const isScanningRef = useRef(true);

  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      if ('vibrate' in navigator) navigator.vibrate(80);
    } catch (e) {
      // AudioContext not supported / allowed
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let active = true;
    isScanningRef.current = true;
    setErrorMsg(null);

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        trackRef.current = videoTrack;

        if (videoTrack && videoTrack.getCapabilities && videoTrack.getCapabilities().torch) {
          setHasTorch(true);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
        }

        // Use native BarcodeDetector API if available
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
          });

          const scanLoop = async () => {
            if (!active || !isScanningRef.current || !videoRef.current) return;
            try {
              if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  const scannedValue = barcodes[0].rawValue.trim();
                  if (scannedValue) {
                    isScanningRef.current = false;
                    playChime();
                    onDetected(scannedValue);
                    onClose();
                    return;
                  }
                }
              }
            } catch (err) {
              console.warn('BarcodeDetector frame error:', err);
            }

            if (active && isScanningRef.current) {
              requestAnimationFrame(scanLoop);
            }
          };

          requestAnimationFrame(scanLoop);
        }
      } catch (err) {
        console.error('Camera access error:', err);
        setErrorMsg('Unable to access camera. Please check camera permissions or enter the barcode number below.');
      }
    }

    startCamera();

    return () => {
      active = false;
      isScanningRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  const toggleTorch = async () => {
    if (!trackRef.current) return;
    try {
      const next = !torchOn;
      await trackRef.current.applyConstraints({
        advanced: [{ torch: next }]
      });
      setTorchOn(next);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      playChime();
      onDetected(manualCode.trim());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(6px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#0f172a',
        color: '#ffffff',
        width: '100%',
        maxWidth: '460px',
        borderRadius: '20px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Barcode size={20} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Scan Product Barcode</h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>Point camera at package barcode</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '280px',
          background: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          <video
            ref={videoRef}
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />

          {/* Viewfinder Target Framing */}
          <div style={{
            position: 'absolute',
            width: '240px',
            height: '140px',
            border: '2px solid rgba(56, 189, 248, 0.8)',
            borderRadius: '14px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
            pointerEvents: 'none'
          }}>
            {/* Animated Laser Scanning Beam */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #38bdf8, #ef4444, #38bdf8, transparent)',
              boxShadow: '0 0 8px #38bdf8',
              animation: 'adminLaserScan 2s ease-in-out infinite alternate'
            }} />
          </div>

          <style>{`
            @keyframes adminLaserScan {
              0% { transform: translateY(-50px); opacity: 0.6; }
              50% { opacity: 1; }
              100% { transform: translateY(50px); opacity: 0.6; }
            }
          `}</style>

          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: torchOn ? '#eab308' : 'rgba(0, 0, 0, 0.6)',
                color: torchOn ? '#000' : '#fff',
                border: 'none',
                borderRadius: '20px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                backdropFilter: 'blur(4px)'
              }}
            >
              🔦 {torchOn ? 'Flash ON' : 'Flash OFF'}
            </button>
          )}

          {errorMsg && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              textAlign: 'center'
            }}>
              <AlertCircle size={36} color="#ef4444" style={{ marginBottom: '10px' }} />
              <p style={{ margin: 0, fontSize: '13px', color: '#f87171' }}>{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Manual Barcode Entry Fallback */}
        <div style={{ padding: '16px 20px', background: '#1e293b' }}>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Or type/paste barcode manually..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              style={{
                flex: 1,
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 16px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: manualCode.trim() ? 'pointer' : 'not-allowed',
                opacity: manualCode.trim() ? 1 : 0.6
              }}
            >
              Apply
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
