import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

/**
 * Gets high-accuracy current device location.
 * Prompts native Android OS location permission dialog if running in Capacitor APK.
 * Falls back to browser navigator.geolocation on web desktop.
 */
export async function getDeviceLocation(options = { enableHighAccuracy: true, timeout: 10000 }) {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      // 1. Check current permissions
      let status = await Geolocation.checkPermissions();
      if (status.location !== 'granted') {
        status = await Geolocation.requestPermissions();
      }

      if (status.location === 'granted') {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: options.enableHighAccuracy ?? true,
          timeout: options.timeout ?? 10000,
          maximumAge: 0
        });
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
      }
    } catch (nativeErr) {
      console.warn('Native Capacitor geolocation error, falling back to navigator:', nativeErr);
    }
  }

  // Fallback to standard web navigator.geolocation
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported by device'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        timeout: options.timeout ?? 10000,
        maximumAge: 0
      }
    );
  });
}
