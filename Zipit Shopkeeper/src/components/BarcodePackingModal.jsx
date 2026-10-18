import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Barcode, Volume2, VolumeX, Sparkles, Check, ChevronRight } from 'lucide-react';

export default function BarcodePackingModal({ order, onClose, onComplete }) {
  const [itemsStatus, setItemsStatus] = useState(() => {
    const initial = {};
    (order.items || []).forEach((item, index) => {
      const key = `${item.id || item.name}_${index}`;
      const neededQty = item.quantity || item.qty || 1;
      initial[key] = {
        name: item.name,
        amount: item.amount,
        price: item.price,
        image_url: item.image_url,
        neededQty,
        scannedQty: 0,
        barcode: item.barcode || '',
        verified: false
      };
    });
    return initial;
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [lastScannedResult, setLastScannedResult] = useState(null);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isScanningRef = useRef(true);

  // Audio synthesize sound chimes (0 external audio assets needed!)
  const playChime = (isSuccess) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isSuccess) {
        // High crisp double-ding (880Hz -> 1320Hz)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);

        // Haptic vibration
        if ('vibrate' in navigator) navigator.vibrate(60);
      } else {
        // Low buzzer alert (160Hz)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(130, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);

        // Heavy double vibration
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {
      console.warn('Audio chime fallback:', e);
    }
  };

  // Match scanned code against order items
  const handleBarcodeDetected = (rawCode) => {
    if (!rawCode || !isScanningRef.current) return;
    const cleanCode = String(rawCode).trim().toUpperCase();

    // Debounce identical scans in rapid succession
    if (lastScannedResult?.code === cleanCode && Date.now() - lastScannedResult.time < 1600) {
      return;
    }
    setLastScannedResult({ code: cleanCode, time: Date.now() });

    // Look for matching item by barcode or name match
    let matchedKey = null;
    for (const [key, item] of Object.entries(itemsStatus)) {
      if (item.verified) continue; // Skip already finished items

      // 1. Direct barcode match
      if (item.barcode && item.barcode.toUpperCase() === cleanCode) {
        matchedKey = key;
        break;
      }
      // 2. Barcode stored inside item name or clean code matching
      if (cleanCode.length >= 4 && item.name.toUpperCase().includes(cleanCode)) {
        matchedKey = key;
        break;
      }
    }

    if (matchedKey) {
      // Correct Item Scanned
      setItemsStatus(prev => {
        const item = prev[matchedKey];
        const nextScanned = item.scannedQty + 1;
        const isNowVerified = nextScanned >= item.neededQty;
        return {
          ...prev,
          [matchedKey]: {
            ...item,
            scannedQty: nextScanned,
            verified: isNowVerified
          }
        };
      });

      playChime(true);
      setScanFeedback({
        type: 'success',
        message: `Verified: ${itemsStatus[matchedKey].name} (${itemsStatus[matchedKey].scannedQty + 1}/${itemsStatus[matchedKey].neededQty})`
      });
    } else {
      // Mismatch
      playChime(false);
      setScanFeedback({
        type: 'error',
        message: `Mismatch: Barcode "${cleanCode}" does not match any pending item in this order.`
      });
    }

    setTimeout(() => setScanFeedback(null), 3200);
  };

  // Setup HTML5 BarcodeDetector or fallback video loop
  useEffect(() => {
    let active = true;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        // Native BarcodeDetector loop if supported by mobile browser
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
          });

          const scanLoop = async () => {
            if (!active || !videoRef.current) return;
            try {
              if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  handleBarcodeDetected(barcodes[0].rawValue);
                }
              }
            } catch (err) {
              // Ignore single frame detection hiccups
            }
            if (active) requestAnimationFrame(scanLoop);
          };
          scanLoop();
        }
      } catch (err) {
        console.warn('Camera permission or device error:', err);
        setCameraActive(false);
      }
    }

    if (cameraActive) {
      initCamera();
    }

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [cameraActive, itemsStatus]);

  // Check overall verification completion
  const totalItemsCount = Object.keys(itemsStatus).length;
  const verifiedCount = Object.values(itemsStatus).filter(i => i.verified).length;
  const isFullyPacked = totalItemsCount > 0 && verifiedCount === totalItemsCount;

  const handleManualPass = (key) => {
    setItemsStatus(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        scannedQty: prev[key].neededQty,
        verified: true
      }
    }));
    playChime(true);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '520px',
        maxHeight: '94vh',
        borderRadius: '24px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
      }}>
        {/* Top Header */}
        <div style={{
          padding: '16px 20px',
          background: '#0f172a',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1e293b'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Barcode size={20} color="#F8CB46" />
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>
                Barcode Order Packing
              </h3>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Order #{order.id?.slice(0, 8).toUpperCase()} · {verifiedCount}/{totalItemsCount} Verified
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              style={{
                background: '#1e293b',
                border: 'none',
                color: soundEnabled ? '#22c55e' : '#94a3b8',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#1e293b',
                border: 'none',
                color: '#ffffff',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Camera Viewfinder View */}
        <div style={{ position: 'relative', height: '220px', background: '#000000', overflow: 'hidden' }}>
          {cameraActive ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* Scanning Reticle Overlay */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '240px',
                height: '110px',
                border: '2px solid rgba(248, 203, 70, 0.85)',
                borderRadius: '14px',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: '90%',
                  height: '2px',
                  background: 'rgba(239, 68, 68, 0.85)',
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.8)',
                  animation: 'scanLine 2s infinite ease-in-out'
                }} />
              </div>
              <style>{`
                @keyframes scanLine {
                  0% { transform: translateY(-40px); }
                  50% { transform: translateY(40px); }
                  100% { transform: translateY(-40px); }
                }
              `}</style>
            </>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#94a3b8',
              padding: '16px',
              textAlign: 'center'
            }}>
              <Barcode size={36} color="#64748b" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc' }}>
                Camera Scanner Inactive
              </div>
              <p style={{ fontSize: '12px', margin: '4px 0 12px', maxWidth: '280px' }}>
                Use manual barcode code entry below or check off items.
              </p>
              <button
                onClick={() => setCameraActive(true)}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Enable Camera
              </button>
            </div>
          )}

          {/* Toast feedback pill */}
          {scanFeedback && (
            <div style={{
              position: 'absolute',
              bottom: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: scanFeedback.type === 'success' ? '#15803d' : '#b91c1c',
              color: '#ffffff',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '12.5px',
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              maxWidth: '90%',
              zIndex: 10
            }}>
              {scanFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{scanFeedback.message}</span>
            </div>
          )}
        </div>

        {/* Quick Manual Code Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualCodeInput.trim()) {
              handleBarcodeDetected(manualCodeInput);
              setManualCodeInput('');
            }
          }}
          style={{
            padding: '10px 16px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            gap: '8px'
          }}
        >
          <input
            type="text"
            placeholder="Type barcode or item name & press Enter..."
            value={manualCodeInput}
            onChange={(e) => setManualCodeInput(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: 'none',
              background: '#0f172a',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '12.5px',
              cursor: 'pointer'
            }}
          >
            Verify
          </button>
        </form>

        {/* Items Checklist List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Object.entries(itemsStatus).map(([key, item]) => {
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: item.verified ? '#f0fdf4' : '#ffffff',
                  border: item.verified ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: item.verified ? '#dcfce7' : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {item.verified ? (
                      <CheckCircle2 size={22} color="#16a34a" />
                    ) : (
                      <Barcode size={22} color="#64748b" />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: item.verified ? '#15803d' : '#0f172a' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '8px', marginTop: '2px' }}>
                      {item.amount && <span>{item.amount}</span>}
                      {item.barcode ? (
                        <span style={{ fontFamily: 'monospace', color: '#475569' }}>
                          Code: {item.barcode}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                          (Loose / No Barcode)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: item.verified ? '#15803d' : '#64748b',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: item.verified ? '#dcfce7' : '#f1f5f9'
                  }}>
                    {item.scannedQty}/{item.neededQty}
                  </span>

                  {!item.verified && (
                    <button
                      onClick={() => handleManualPass(key)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#334155',
                        fontWeight: 700,
                        fontSize: '11.5px',
                        cursor: 'pointer'
                      }}
                      title="Manually verify loose or unbarcoded item"
                    >
                      Pass
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Bottom Completion Action Bar */}
        <div style={{
          padding: '16px 20px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '14px 20px',
              borderRadius: '14px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            onClick={() => {
              if (isFullyPacked && onComplete) {
                onComplete();
              }
            }}
            disabled={!isFullyPacked}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '14px',
              border: 'none',
              background: isFullyPacked ? '#16a34a' : '#cbd5e1',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '14.5px',
              cursor: isFullyPacked ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: isFullyPacked ? '0 4px 16px rgba(22, 163, 74, 0.3)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            {isFullyPacked ? (
              <>
                <Check size={18} /> All Items Verified · Mark Ready for Pickup
              </>
            ) : (
              `Scan Remaining Items (${verifiedCount}/${totalItemsCount})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
