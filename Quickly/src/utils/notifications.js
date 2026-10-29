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
    setupNotificationChannels();
    const localPerm = await LocalNotifications.requestPermissions();
    console.log('[Notifications] Native permission status:', localPerm.display);
    return localPerm.display === 'granted';
  } catch (err) {
    console.warn('[Notifications] Error requesting notification permissions:', err);
    return false;
  }
};

// Map order statuses to custom user-friendly notifications and target routes
export const getOrderStatusNotification = (status, orderId) => {
  const shortId = (orderId || '').slice(0, 8).toUpperCase();
  const norm = (status || '').toLowerCase().trim();

  if (norm.includes('deliver')) {
    return {
      title: 'Order Delivered! 🎉',
      body: `Your order #${shortId} is delivered. Enjoy your day !`,
      route: '/past-orders'
    };
  }
  if (norm.includes('refund')) {
    return {
      title: 'Refund Processed 💰',
      body: `Refund for order #${shortId} has been initiated. Tap to view your orders.`,
      route: '/past-orders'
    };
  }
  if (norm.includes('cancel')) {
    return {
      title: 'Order Cancelled ❌',
      body: `Order #${shortId} was cancelled. Tap to view details.`,
      route: '/past-orders'
    };
  }
  if (norm.includes('ready') || norm.includes('pickup')) {
    return {
      title: 'Ready for Pickup! 🛵',
      body: `Order #${shortId} is packed and waiting for delivery partner pickup.`,
      route: '/track'
    };
  }
  if (norm.includes('out') || norm.includes('way')) {
    return {
      title: 'Out for Delivery! 🚀',
      body: `Your delivery partner is on the way with order #${shortId}!`,
      route: '/track'
    };
  }
  if (norm.includes('pack') || norm.includes('prepar')) {
    return {
      title: 'Order Being Packed! 📦',
      body: `Items in order #${shortId} are being packed fresh at the store.`,
      route: '/track'
    };
  }
  if (norm.includes('accept') || norm.includes('confirm')) {
    return {
      title: 'Order Confirmed! 👨‍🍳',
      body: `Store has accepted order #${shortId} and started preparing.`,
      route: '/track'
    };
  }

  return {
    title: `Order Update: ${status} 🛍️`,
    body: `Your Quickly order #${shortId} is now ${status}.`,
    route: '/track'
  };
};

// Dispatch high-priority native notification with zero artificial delay
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
    if (!isChannelCreated) {
      setupNotificationChannels();
    }
    const notifId = Math.floor(Math.random() * 2147483647);

    // Immediate dispatch without artificial delay
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title: title || 'Quickly Order Update',
          body: body || 'Your order status has been updated.',
          channelId: 'orders',
          smallIcon: 'ic_launcher',
          iconColor: '#F8CB46',
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
