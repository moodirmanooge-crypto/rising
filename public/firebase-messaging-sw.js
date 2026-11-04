/* public/firebase-messaging-sw.js
 * Service worker: fariimaha admin-ka (exam cusub) — xitaa marka tab-ka / browser-ka xiran yahay
 * (FCM push, eeg src/config/push.js). Sidoo kale wuxuu muujiyaa notification-ka marka tab-ku furan yahay.
 */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBXFegVGIyVk02zY6Ks3DhcoWjomNw_ht0",
  authDomain: "one-click-onilne.firebaseapp.com",
  projectId: "one-click-onilne",
  storageBucket: "one-click-onilne.firebasestorage.app",
  messagingSenderId: "988928725446",
  appId: "1:988928725446:web:1c9c9c5a30b7ea0b43a2c7",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const n = payload.notification || {};
  self.registration.showNotification(n.title || d.title || "📝 Exam cusub ayaa la soo diray!", {
    body: n.body || d.body || "",
    tag: d.tag || "rss-exam",
    renotify: true,
    requireInteraction: true,
    icon: "/logo.png",
    badge: "/logo.png",
    vibrate: [300, 150, 300, 150, 600],
    data: { url: d.url || "/admin" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes("/admin") && "focus" in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));