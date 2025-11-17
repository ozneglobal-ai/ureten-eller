const CACHE_NAME = "ureteneller-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/home.html",
  "/profile.html",
  "/ilan-ver.html",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/img/avatar-default.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (!cacheWhitelist.includes(name)) {
            return caches.delete(name);
          }
        })
      )
    )
  );
});
