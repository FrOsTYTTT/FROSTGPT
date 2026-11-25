
const CACHE_NAME = "frostgpt-v4";

const APP_FILES = [
  "/",
  "/index.html",
  "/app.js",
  "/classic.js",
  "/manifest.json",
  "/styles.css",
  "/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests, other websites, and backend API calls.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Always check the network first for important app files.
  const networkFirstFiles = [
    "/",
    "/index.html",
    "/app.js",
    "/classic.js",
    "/manifest.json"
  ];

  const isImportantFile = networkFirstFiles.includes(url.pathname);

  if (request.mode === "navigate" || isImportantFile) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);

          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());

            if (request.mode === "navigate") {
              await cache.put("/", response.clone());
            }
          }

          return response;
        } catch (error) {
          const cached =
            await caches.match(request) ||
            await caches.match("/index.html") ||
            await caches.match("/");

          if (cached) return cached;

          return new Response("FROSTGPT is offline. Please reconnect and reload.", {
            status: 503,
            headers: { "Content-Type": "text/plain" }
          });
        }
      })()
    );

    return;
  }

  // Other assets use cache first, then network.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        return new Response("Asset unavailable while offline.", {
          status: 503,
          headers: { "Content-Type": "text/plain" }
        });
      }
    })()
  );
});
