const TILE_CACHE_NAME = "streets-map-tiles-v1";
const TILE_HOSTS = new Set([
  "a.tile.openstreetmap.org",
  "b.tile.openstreetmap.org",
  "c.tile.openstreetmap.org",
  "a.basemaps.cartocdn.com",
  "b.basemaps.cartocdn.com",
  "c.basemaps.cartocdn.com",
  "d.basemaps.cartocdn.com",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const isTileRequest = (requestUrl, request) => {
  if (request.method !== "GET") {
    return false;
  }

  if (requestUrl.protocol !== "https:") {
    return false;
  }

  return TILE_HOSTS.has(requestUrl.hostname);
};

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (!isTileRequest(requestUrl, event.request)) {
    return;
  }

  event.respondWith(
    caches.open(TILE_CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) {
        event.waitUntil(
          fetch(event.request)
            .then((networkResponse) => {
              cache.put(event.request, networkResponse.clone());
            })
            .catch(() => {
              // Ignore refresh failures; cached tile is already served.
            }),
        );

        return cached;
      }

      try {
        const networkResponse = await fetch(event.request);
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      } catch {
        return new Response("", { status: 504, statusText: "Tile unavailable" });
      }
    }),
  );
});
