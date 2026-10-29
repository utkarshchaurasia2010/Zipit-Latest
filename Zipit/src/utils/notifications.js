import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '../services/db';

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
    console.warn('Could not create notification channel:', err);
  }
};

// Request runtime notification permissions (required on Android 13+)
// Safe and crash-proof: Uses Android LocalNotifications permission prompt
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
    // This prompts Android's native runtime POST_NOTIFICATIONS permission dialog
    const localPerm = await LocalNotifications.requestPermissions();
    console.log('[Notifications] Permission status:', localPerm.display);

    // Safely attempt push registration only if available (never crash app)
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      if (PushNotifications && typeof PushNotifications.checkPermissions === 'function') {
        const check = await PushNotifications.checkPermissions();
        if (check.receive === 'granted') {
          // Wrap in try-catch to avoid native Firebase initialization crash
          PushNotifications.register().catch(e => console.warn('Push register skipped:', e));
        }
      }
    } catch (_) {}
  } catch (err) {
    console.warn('Error requesting notification permissions:', err);
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
    console.warn('Failed to schedule native notification:', err);
  }
};

// Initialize listeners for push and local notifications
export const initPushNotificationListeners = (navigate, showToast) => {
  if (!Capacitor.isNativePlatform()) return () => {};

  setupNotificationChannels();

  // Action performed on local notification tap
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

  // Safe Push Notifications listeners (guarded so it never crashes)
  let pushRegHandle = null;
  let pushRecvHandle = null;
  let pushActionHandle = null;

  import('@capacitor/push-notifications').then(({ PushNotifications }) => {
    try {
      PushNotifications.addListener('registration', async (token) => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id && token?.value) {
            await supabase.from('profiles').update({ fcm_token: token.value }).eq('id', user.id);
          }
        } catch (_) {}
      }).then(h => { pushRegHandle = h; }).catch(() => {});

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        sendNativeAppNotification({
          title: notification.title,
          body: notification.body,
          extra: notification.data
        });
        if (showToast) {
          showToast(notification.title || 'Quickly Notification', notification.body || '', 'info');
        }
      }).then(h => { pushRecvHandle = h; }).catch(() => {});

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        const data = notification.notification?.data || {};
        if (data.route && navigate) {
          navigate(data.route);
        } else if (data.order_id && navigate) {
          navigate('/track');
        }
      }).then(h => { pushActionHandle = h; }).catch(() => {});
    } catch (_) {}
  }).catch(() => {});

  return () => {
    if (localActionHandle && typeof localActionHandle.remove === 'function') {
      localActionHandle.remove();
    }
    if (pushRegHandle && typeof pushRegHandle.remove === 'function') {
      pushRegHandle.remove();
    }
    if (pushRecvHandle && typeof pushRecvHandle.remove === 'function') {
      pushRecvHandle.remove();
    }
    if (pushActionHandle && typeof pushActionHandle.remove === 'function') {
      pushActionHandle.remove();
    }
  };
};
