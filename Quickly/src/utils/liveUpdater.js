import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { supabase } from '../services/db';

/**
 * Live OTA Bundle Updater for Quickly Android App
 * Automatically downloads and applies JavaScript/CSS/HTML updates over-the-air
 * without requiring the user to reinstall or update APK.
 */

let isUpdating = false;
let realtimeChannel = null;

export const initLiveUpdater = async () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // 1. Notify native layer that current bundle booted successfully.
    // This is Capgo's safety latch - confirms the bundle works so it doesn't roll back.
    await CapacitorUpdater.notifyAppReady();
    console.log('[LiveUpdater] Current bundle verified as ready');

    // 2. Check for updates on startup after a short delay for smooth first render
    setTimeout(() => {
      checkForLiveBundleUpdate(true);
    }, 2500);

    // 3. Realtime Supabase listener: when Admin saves a new OTA version, download & apply immediately!
    if (!realtimeChannel) {
      realtimeChannel = supabase.channel('realtime-ota-listener')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: 'id=eq.00000000-0000-0000-0000-000000000001'
        }, async (payload) => {
          if (payload.new?.address) {
            try {
              const data = typeof payload.new.address === 'string' ? JSON.parse(payload.new.address) : payload.new.address;
              if (data.ota_bundle_version && data.ota_bundle_url) {
                console.log('[LiveUpdater] New OTA version published in admin:', data.ota_bundle_version);
                await checkForLiveBundleUpdate(true);
              }
            } catch (_) {}
          }
        })
        .subscribe();
    }
  } catch (err) {
    console.warn('[LiveUpdater] init failed:', err);
  }
};

export const checkForLiveBundleUpdate = async (immediateApply = true) => {
  if (!Capacitor.isNativePlatform() || isUpdating) {
    return null;
  }

  try {
    isUpdating = true;

    // Fetch latest OTA config from Supabase profiles (address column stores branding JSON)
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

    const latestVersion = (branding.ota_bundle_version || '').trim();
    const latestUrl = (branding.ota_bundle_url || '').trim();

    if (!latestVersion || !latestUrl) {
      isUpdating = false;
      return null;
    }

    // Get current bundle version
    const current = await CapacitorUpdater.current();
    console.log('[LiveUpdater] Current bundle version:', current?.version, 'Latest available:', latestVersion);

    if (current?.version === latestVersion) {
      console.log('[LiveUpdater] Already running latest version:', latestVersion);
      isUpdating = false;
      return null;
    }

    console.log(`[LiveUpdater] Downloading OTA bundle update ${latestVersion} from ${latestUrl}...`);

    // Download and extract zip package in background
    const bundle = await CapacitorUpdater.download({
      url: latestUrl,
      version: latestVersion,
    });

    console.log('[LiveUpdater] Downloaded and unpacked bundle:', bundle.id);

    if (immediateApply) {
      // Instantly switch WebView to the new bundle and reload UI
      console.log('[LiveUpdater] Applying bundle immediately via CapacitorUpdater.set...');
      await CapacitorUpdater.set({ id: bundle.id });
    } else {
      // Stage bundle to load automatically on next launch/restart
      await CapacitorUpdater.next({ id: bundle.id });
    }

    isUpdating = false;
    return bundle;
  } catch (err) {
    console.warn('[LiveUpdater] Error downloading OTA bundle:', err);
    isUpdating = false;
    return null;
  }
};

