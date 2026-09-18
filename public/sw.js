/* KeyLess /movil service worker — app-shell cache only.
 *
 * Goal: the installed app opens instantly (and shows its UI) even with a bad
 * connection. We NEVER cache API calls (Groq / /api/*) or anything outside
 * /movil, /icons and the Next static chunks. Network-first for navigations so
 * a deploy is picked up on the next open; cache-first for immutable chunks.
 */
const VERSION = "kf-movil-v1";
const SHELL = ["/movil", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Groq etc. → untouched
  if (url.pathname.startsWith("/api/")) return;

  const isShellNav = req.mode === "navigate" && url.pathname.startsWith("/movil");
  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
  if (!isShellNav && !isStatic && !SHELL.includes(url.pathname)) return;

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        return res;
      })),
    );
    return;
  }

  // Shell: network first, fall back to the cached copy when offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/movil"))),
  );
});
