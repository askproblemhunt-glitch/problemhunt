/* ProblemHunt service worker: offline shell, background push alerts, notification routing. */
const VERSION = "ph-v5.0.0";
const SHELL = ["/", "/sos/", "/guide/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/ws") return; // live data: never cache

  if (req.mode === "navigate") {
    // network-first so users always get the latest dashboard, offline falls back to cached shell
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/")))
    );
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    // immutable assets: cache-first
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});

const SEV_VIBRATE = { critical: [200, 80, 200, 80, 400], high: [200, 80, 200], medium: [120], low: [] };

self.addEventListener("push", (event) => {
  let data = { title: "ProblemHunt", body: "A threat was neutralized.", tag: "ph", url: "/", severity: "high" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) { if (event.data) data.body = event.data.text(); }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      renotify: true,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      vibrate: SEV_VIBRATE[data.severity] || [],
      requireInteraction: data.severity === "critical",
      data: { url: data.url || "/" },
      actions: [{ action: "open", title: "Open command center" }],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) if (w.url.startsWith(self.location.origin)) return w.focus();
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // Browser rotated the subscription: re-register it with the same server key.
  event.waitUntil(
    fetch("/api/push/public-key").then((r) => r.json()).then(({ publicKey }) => {
      if (!publicKey) return;
      const pad = "=".repeat((4 - (publicKey.length % 4)) % 4);
      const raw = atob((publicKey + pad).replace(/-/g, "+").replace(/_/g, "/"));
      const key = Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
      return self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
        .then((sub) => fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) }));
    })
  );
});
