/* firebase-messaging-sw.js */
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Yeni mesaj';
  const body  = payload.notification?.body  || '';
  const icon  = '/assets/icons/favicon.png';
  self.registration.showNotification(title, { body, icon, badge: icon });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = '/mesajlar.html';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
    for (const w of wins) {
      if (w.url.includes(url)) return w.focus();
    }
    return clients.openWindow(url);
  }));
});
