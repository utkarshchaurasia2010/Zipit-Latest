import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

let isChannelCreated = false;

// Ensure high-priority notification channel is created for Android 8.0+
export const setupNotificationChannels = async () => {
  if (!Capacitor.isNativePlatform()) return;
  if (isChannelCreated) return;

  try {
    await LocalNotifications.createChannel({
      id: 'orders',
      name: 'Order Updates',
      description: 'Realtime order tracking and delivery status alerts',
      importance: 5, // High importance (Heads-up banner & sound)
      visibility: 1, // Public on lockscreen
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#F8CB46'
    });
    isChannelCreated = true;
  } catch (err) {
    console.warn('[Notifications] Could not create notification channel:', err);
  }
};

// Request runtime notification permissions (required on Android 13+)
// 100% crash-proof: Uses Android LocalNotifications permission prompt
export const requestAppNotificationPermission = async () => {
  if (!Capacitor.isNativePlatform()) {
    if ('Notification' in window && Notification.permission !== 'granted') {
      try {
        await Notification.requestPermission();
      } catch (_) {}
    }
    return;
  }

  try {
    await setupNotificationChannels();
    // This prompts Android's native runtime POST_NOTIFICATIONS permission dialog safely
    const localPerm = await LocalNotifications.requestPermissions();
    console.log('[Notifications] Native permission status:', localPerm.display);
    return localPerm.display === 'granted';
  } catch (err) {
    console.warn('[Notifications] Error requesting notification permissions:', err);
    return false;
  }
};

// Dispatch high-priority native notification like Blinkit / WhatsApp
export const sendNativeAppNotification = async ({ title, body, extra = {} }) => {
  // If running in browser, try Web Notification API
  if (!Capacitor.isNativePlatform()) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/logo_full.png',
          badge: '/logo_full.png'
        });
      } catch (_) {}
    }
    return;
  }

  try {
    await setupNotificationChannels();
    const notifId = Math.floor(Math.random() * 2147483647);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title: title || 'Quickly Order Update',
          body: body || 'Your order status has been updated.',
          channelId: 'orders',
          smallIcon: 'ic_launcher',
          iconColor: '#F8CB46',
          schedule: { at: new Date(Date.now() + 50) },
          sound: 'default',
          extra
        }
      ]
    });
  } catch (err) {
    console.warn('[Notifications] Failed to schedule native notification:', err);
  }
};

// Initialize listeners for notification tap actions
export const initPushNotificationListeners = (navigate, showToast) => {
  if (!Capacitor.isNativePlatform()) return () => {};

  setupNotificationChannels();

  // Action performed on notification tap
  let localActionHandle = null;
  try {
    LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      const extra = notification.notification?.extra || {};
      if (extra.route && navigate) {
        navigate(extra.route);
      } else if (navigate) {
        navigate('/track');
      }
    }).then(h => { localActionHandle = h; }).catch(() => {});
  } catch (_) {}

  return () => {
    if (localActionHandle && typeof localActionHandle.remove === 'function') {
      localActionHandle.remove();
    }
  };
};
