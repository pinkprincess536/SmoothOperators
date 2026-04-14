const CACHE = "malnutrition-screening-v2";
const PRECACHE_ASSETS = [
  "./index.html",
  "./css/app.css",
  "./js/app.js",
  "./js/ai.js",
  "./js/lms.js",
  "./js/muac.js",
  "./js/diagnosis.js",
  "./js/storage.js",
  "./data/lms.json",
  "./manifest.json",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE_ASSETS.map((url) =>
            cache.add(url).catch(() => {
              /* tolerate missing optional paths in dev */
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const reqUrl = new URL(request.url);
  const isNavigation = request.mode === "navigate";
  const isSameOrigin = reqUrl.origin === self.location.origin;
  const isPrecachedPath = isSameOrigin && PRECACHE_ASSETS.some((a) => reqUrl.pathname.endsWith(a.replace("./", "/")));

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (isPrecachedPath) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
      return res;
    }).catch(() => {
      return caches.match(request).then((cached) => cached || caches.match("./index.html"));
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
