const CACHE_NAME = "lap-cache-20260707-product-v1";

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

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "LAP",
      body: event.data ? event.data.text() : "Nova atualização esportiva.",
      url: "/",
    };
  }

  const title = payload.title || "LAP";
  const options = {
    body: payload.body || "Nova atualização esportiva.",
    icon: "/icons/lap-icon.svg",
    badge: "/icons/lap-icon.svg",
    tag: payload.tag || payload.eventKey || "lap-live-alert",
    data: {
      url: payload.url || "/",
      eventKey: payload.eventKey || null,
      eventType: payload.eventType || null,
    },
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url === targetUrl) return client.focus();
      }

      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});
