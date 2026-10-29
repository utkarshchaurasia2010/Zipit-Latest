import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
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
    const localPerm = await LocalNotifications.requestPermissions();
    console.log('Local notifications permission:', localPerm.display);

    const pushPerm = await PushNotifications.requestPermissions();
    if (pushPerm.receive === 'granted') {
      await PushNotifications.register();
    }
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

  // Push registration token listener
  const pushRegHandle = PushNotifications.addListener('registration', async (token) => {
    console.log('Native Push Registration Token:', token.value);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase.from('profiles').update({ fcm_token: token.value }).eq('id', user.id);
      }
    } catch (_) {}
  });

  // Push notification received while in foreground
  const pushRecvHandle = PushNotifications.addListener('pushNotificationReceived', (notification) => {
    sendNativeAppNotification({
      title: notification.title,
      body: notification.body,
      extra: notification.data
    });
    if (showToast) {
      showToast(notification.title || 'Quickly Notification', notification.body || '', 'info');
    }
  });

  // Action performed on push notification tap
  const pushActionHandle = PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    const data = notification.notification?.data || {};
    if (data.route && navigate) {
      navigate(data.route);
    } else if (data.order_id && navigate) {
      navigate('/track');
    }
  });

  // Action performed on local notification tap
  const localActionHandle = LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
    const extra = notification.notification?.extra || {};
    if (extra.route && navigate) {
      navigate(extra.route);
    } else if (navigate) {
      navigate('/track');
    }
  });

  return () => {
    pushRegHandle.then(h => h.remove()).catch(() => {});
    pushRecvHandle.then(h => h.remove()).catch(() => {});
    pushActionHandle.then(h => h.remove()).catch(() => {});
    localActionHandle.then(h => h.remove()).catch(() => {});
  };
};
