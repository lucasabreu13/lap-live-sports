const CACHE_NAME = "lap-cache-20260707-ux2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("lap-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  const cacheable =
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/");

  if (!cacheable) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();

          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)),
          );
        }

        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});