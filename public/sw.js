const CACHE_VERSION = "jabu-study-pwa-v1";
const PRECACHE = `${CACHE_VERSION}-precache`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = [
  "/offline",
  "/manifest.json",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512-maskable.png",
  "/icon-192-maskable.png"
];

function isHttpRequest(request) {
  return request.url.startsWith("http://") || request.url.startsWith("https://");
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function shouldBypass(request, url) {
  if (!isHttpRequest(request)) return true;
  if (request.method !== "GET") return true;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return true;

  if (isSameOrigin(url) && url.pathname.startsWith("/api/")) return true;

  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (host.endsWith(".supabase.co") && (path.includes("/auth/") || path.includes("/rest/"))) {
    return true;
  }

  return false;
}

function isStaticAsset(request, url) {
  if (request.destination === "script") return true;
  if (request.destination === "style") return true;
  if (request.destination === "font") return true;
  if (request.destination === "image") return true;
  if (request.destination === "manifest") return true;

  if (!isSameOrigin(url)) return false;
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/favicon.ico" ||
    /^\/icon-\d+.*\.png$/.test(url.pathname)
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    cache.put(request, response.clone());
  }
  return response;
}

async function navigationNetworkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(PRECACHE);
    return (await cache.match("/offline")) || Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("jabu-study-pwa-") && !name.startsWith(CACHE_VERSION))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (shouldBypass(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(cacheFirst(request));
  }
});

function safeNotificationUrl(href) {
  try {
    const url = new URL(href || "/", self.location.origin);
    if (url.origin !== self.location.origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "JabuStudy",
      body: event.data ? event.data.text() : "You have a new update."
    };
  }

  const title = payload.title || "JabuStudy";
  const options = {
    body: payload.body || "You have a new update.",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag,
    data: {
      ...(payload.data || {}),
      href: safeNotificationUrl(payload.data?.href || payload.href || "/")
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetPath = safeNotificationUrl(event.notification.data?.href || "/");
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          if ("navigate" in client && client.url !== targetUrl) {
            return client.navigate(targetUrl).then((navigatedClient) => {
              return navigatedClient ? navigatedClient.focus() : client.focus();
            });
          }
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
