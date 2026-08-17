// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
const firebaseConfig = {
  apiKey: "AIzaSyAkaW26zr8r2Df_vDm0xITd15Kd9reFJV4",
  authDomain: "zipit-242f8.firebaseapp.com",
  projectId: "zipit-242f8",
  storageBucket: "zipit-242f8.firebasestorage.app",
  messagingSenderId: "745821360884",
  appId: "1:745821360884:web:52dd2190ce46d08b34c4a1"
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo_full.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
