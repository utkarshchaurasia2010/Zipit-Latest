import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { supabase } from '../services/db';

/**
 * Live OTA Bundle Updater for Quickly Android App
 * Automatically downloads and applies JavaScript/CSS/HTML updates over-the-air
 * without requiring the user to reinstall or update APK.
 */

let isUpdating = false;

export const initLiveUpdater = async () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // 1. Notify native layer that the current bundle booted successfully.
    // This is Capgo's safety latch - if an update crashes before this line,
    // the native app automatically rolls back to the built-in factory bundle.
    await CapacitorUpdater.notifyAppReady();
    console.log('[LiveUpdater] Current bundle verified as ready');

    // 2. Check for updates after a brief delay so initial render is smooth
    setTimeout(() => {
      checkForLiveBundleUpdate();
    }, 4000);
  } catch (err) {
    console.warn('[LiveUpdater] init failed:', err);
  }
};

export const checkForLiveBundleUpdate = async (onUpdateFound = null) => {
  if (!Capacitor.isNativePlatform() || isUpdating) {
    return null;
  }

  try {
    isUpdating = true;

    // Check platform settings in Supabase profiles (address column stores branding JSON)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('address')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle();

    if (error || !profile?.address) {
      isUpdating = false;
      return null;
    }

    let branding = {};
    try {
      branding = typeof profile.address === 'string' ? JSON.parse(profile.address) : profile.address;
    } catch (_) {
      isUpdating = false;
      return null;
    }

    const latestVersion = branding.ota_bundle_version; // e.g. "1.0.12"
    const latestUrl = branding.ota_bundle_url; // Direct HTTPS URL to Quickly-OTA-Bundle.zip

    if (!latestVersion || !latestUrl) {
      isUpdating = false;
      return null;
    }

    // Get current bundle version
    const current = await CapacitorUpdater.current();
    console.log('[LiveUpdater] Current bundle version:', current?.version, 'Latest available:', latestVersion);

    if (current?.version === latestVersion) {
      isUpdating = false;
      return null; // Already up to date
    }

    console.log(`[LiveUpdater] Downloading OTA bundle update ${latestVersion} from ${latestUrl}...`);

    // Download and extract zip package in background
    const bundle = await CapacitorUpdater.download({
      url: latestUrl,
      version: latestVersion,
    });

    console.log('[LiveUpdater] Downloaded and unpacked bundle:', bundle.id);

    // Stage bundle to load automatically on next launch/restart (seamless, non-disruptive)
    await CapacitorUpdater.next({ id: bundle.id });

    if (onUpdateFound) {
      onUpdateFound({ version: latestVersion, id: bundle.id });
    }

    isUpdating = false;
    return bundle;
  } catch (err) {
    console.warn('[LiveUpdater] Error downloading OTA bundle:', err);
    isUpdating = false;
    return null;
  }
};
