const CACHE_NAME = "lap-cache-20260718-realtime-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("lap-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  const cacheable = url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/");
  if (!cacheable) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
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
      body: event.data ? event.data.text() : "Nova atualizacao esportiva.",
      url: "/",
    };
  }

  const title = payload.title || "LAP";
  const eventType = payload.eventType || null;
  const liveTypes = ["start", "score", "halftime", "resume", "final"];
  const options = {
    body: payload.body || "Nova atualizacao esportiva.",
    icon: "/icons/lap-icon.svg",
    badge: "/icons/lap-icon.svg",
    tag: payload.tag || payload.eventKey || "lap-live-alert",
    timestamp: payload.timestamp || Date.now(),
    data: {
      url: payload.url || "/",
      eventKey: payload.eventKey || null,
      eventType,
    },
    renotify: payload.renotify !== false,
    silent: false,
    vibrate: liveTypes.includes(eventType) ? [180, 80, 180] : [120],
  };

  const notifyOpenWindows = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => Promise.all(clients.map((client) => client.postMessage({
      type: "lap:push",
      eventKey: payload.eventKey || null,
      eventType,
      url: payload.url || "/",
      receivedAt: Date.now(),
    }))));

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    notifyOpenWindows,
  ]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const exact = clients.find((client) => client.url === targetUrl);
      if (exact && "focus" in exact) return exact.focus();

      const sameOrigin = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (sameOrigin && "navigate" in sameOrigin && "focus" in sameOrigin) {
        await sameOrigin.navigate(targetUrl);
        return sameOrigin.focus();
      }

      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});
