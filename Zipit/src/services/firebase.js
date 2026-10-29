import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAkaW26zr8r2Df_vDm0xITd15Kd9reFJV4",
  authDomain: "zipit-242f8.firebaseapp.com",
  projectId: "zipit-242f8",
  storageBucket: "zipit-242f8.firebasestorage.app",
  messagingSenderId: "745821360884",
  appId: "1:745821360884:web:52dd2190ce46d08b34c4a1"
};

let app;

try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export const requestFirebaseNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      let swRegistration = null;
      if ('serviceWorker' in navigator) {
        swRegistration = await navigator.serviceWorker.ready;
      }
      
      const messaging = getMessaging(app);
      
      const token = await getToken(messaging, { 
        vapidKey: 'BFYrDeaz-ZxSbp_D_U2bfRNccjQE6r6fcTa2Z8VLenHahrCkbpke931Nvpxq4tLZAf-6SMrYM_FC0tB9WCC08dg',
        serviceWorkerRegistration: swRegistration
      });
      console.log('FCM Token:', token);
      return token;
    } else {
      console.log('Notification permission denied.');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    alert('FCM Error: ' + error.message);
    return null;
  }
};

export const getFirebaseMessaging = () => {
  if (!app) return null;
  try {
    return getMessaging(app);
  } catch (e) {
    return null;
  }
};

export { app };
