import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { supabase } from '../services/db';

/**
 * Live OTA Bundle Updater for Quickly Android App
 * Automatically downloads and applies JavaScript/CSS/HTML updates over-the-air
 * without requiring the user to reinstall or update APK.
 */

export const OFFICIAL_OTA_URL = 'https://github.com/utkarshchaurasia2010/Zipit-Latest/releases/download/live-ota/Quickly-OTA-Bundle.zip';

let isUpdating = false;
let isInitialized = false;
let realtimeChannel = null;

export const initLiveUpdater = async () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  if (isInitialized) {
    return;
  }
  isInitialized = true;

  try {
    // 1. Notify native layer that current bundle booted successfully.
    // This is Capgo's safety latch - confirms the bundle works so it doesn't roll back.
    await CapacitorUpdater.notifyAppReady();
    console.log('[LiveOTA] Current bundle verified as ready');

    // 2. Check for updates on startup after a short delay for smooth first render
    setTimeout(() => {
      checkForLiveBundleUpdate(true);
    }, 2500);

    // 3. Check for updates whenever the app is brought back to foreground from background
    try {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          console.log('[LiveOTA] App foregrounded, checking for OTA updates...');
          checkForLiveBundleUpdate(true);
        }
      });
    } catch (_) {}

    // 4. Realtime Supabase listener: when Admin saves a new OTA version, download & apply immediately!
    if (!realtimeChannel) {
      realtimeChannel = supabase.channel('realtime-ota-listener')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: 'id=eq.00000000-0000-0000-0000-000000000001'
        }, async (payload) => {
          const rawAddress = payload.new?.address;
          if (rawAddress) {
            try {
              const data = typeof rawAddress === 'string' ? JSON.parse(rawAddress) : rawAddress;
              if (data.ota_bundle_version) {
                console.log('[LiveOTA] Realtime signal received for version:', data.ota_bundle_version);
                await checkForLiveBundleUpdate(true);
              }
            } catch (_) {}
          }
        })
        .subscribe((status) => {
          console.log('[LiveOTA] Realtime listener status:', status);
        });
    }
  } catch (err) {
    console.warn('[LiveOTA] init failed:', err);
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
    let latestUrl = (branding.ota_bundle_url || '').trim();

    if (!latestVersion) {
      isUpdating = false;
      return null;
    }

    // Failsafe auto-sanitization: GitHub Actions artifact links require web login and 404 on mobile devices.
    // If detected or missing, automatically use the permanent public GitHub Release asset.
    if (!latestUrl || latestUrl.includes('actions/runs') || latestUrl.includes('/artifacts/')) {
      console.warn('[LiveOTA] Redirecting private or empty artifact URL to official public release asset');
      latestUrl = OFFICIAL_OTA_URL;
    }

    // Get current bundle version
    const current = await CapacitorUpdater.current();
    const activeVersion = current?.bundle?.version || current?.native || current?.version || '';
    console.log('[LiveOTA] Active bundle version:', activeVersion, 'Latest available:', latestVersion);

    if (activeVersion && activeVersion === latestVersion) {
      console.log('[LiveOTA] Already running latest version:', latestVersion);
      isUpdating = false;
      return null;
    }

    // Retrieve or fetch SHA-256 checksum (strictly required by Capgo v8 on Android)
    let checksum = (branding.ota_bundle_checksum || '').trim();
    if (!checksum && latestUrl.includes('github.com')) {
      try {
        const shaUrl = latestUrl.replace(/\.zip$/i, '.zip.sha256');
        const shaRes = await fetch(shaUrl, { cache: 'no-store' });
        if (shaRes.ok) {
          const shaText = await shaRes.text();
          checksum = shaText.trim().split(/\s+/)[0];
          console.log('[LiveOTA] Retrieved checksum from release:', checksum);
        }
      } catch (_) {}
    }

    console.log(`[LiveOTA] Downloading OTA bundle update ${latestVersion} from ${latestUrl} with checksum: ${checksum || 'auto'}`);

    // Download and extract zip package in background
    const downloadOptions = {
      url: latestUrl,
      version: latestVersion,
    };
    if (checksum) {
      downloadOptions.checksum = checksum;
    }

    const bundle = await CapacitorUpdater.download(downloadOptions);

    console.log('[LiveOTA] Downloaded and unpacked bundle:', bundle.id);

    if (immediateApply) {
      // Instantly switch WebView to the new bundle and reload UI
      console.log('[LiveOTA] Applying bundle immediately via CapacitorUpdater.set...');
      await CapacitorUpdater.set({ id: bundle.id });
    } else {
      // Stage bundle to load automatically on next launch/restart
      await CapacitorUpdater.next({ id: bundle.id });
    }

    isUpdating = false;
    return bundle;
  } catch (err) {
    console.warn('[LiveOTA] Error downloading or applying OTA bundle:', err);
    isUpdating = false;
    return null;
  }
};


