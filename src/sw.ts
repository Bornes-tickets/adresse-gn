// src/sw.ts — Service Worker custom (workbox + push notifications)
/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { clientsClaim } from "workbox-core";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any[] };

self.skipWaiting();
clientsClaim();

// Precache tous les assets buildés
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Navigations HTML : NetworkFirst avec fallback cache
registerRoute(
  new NavigationRoute(new NetworkFirst({ cacheName: "agn-pages", networkTimeoutSeconds: 5 }), {
    denylist: [/^\/~oauth/, /^\/api\//, /^\/_serverFn\//],
  }),
);

// Assets JS/CSS/fonts : CacheFirst
registerRoute(
  ({ request }) => ["script", "style", "font"].includes(request.destination),
  new CacheFirst({
    cacheName: "agn-assets",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }) as any],
  }),
);

// Images : StaleWhileRevalidate
registerRoute(
  ({ request }) => request.destination === "image",
  new StaleWhileRevalidate({
    cacheName: "agn-images",
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }) as any],
  }),
);

/* ==================== PUSH NOTIFICATIONS ==================== */

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  let payload: { title?: string; body?: string; url?: string; tag?: string; icon?: string; badge?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Adresse GN", body: event.data.text() };
  }
  const title = payload.title ?? "Adresse GN";
  const options: NotificationOptions = {
    body: payload.body ?? "",
    icon: payload.icon ?? "/icons/icon-192.png",
    badge: payload.badge ?? "/icons/icon-192.png",
    tag: payload.tag,
    data: { url: payload.url ?? "/" },
    requireInteraction: false,
    vibrate: [200, 100, 200],
  } as NotificationOptions;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string })?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Si une fenêtre existe déjà, la mettre au premier plan
      for (const client of clients) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          (client as WindowClient).focus();
          (client as WindowClient).navigate(targetUrl);
          return;
        }
      }
      // Sinon, ouvrir une nouvelle fenêtre
      return self.clients.openWindow(targetUrl);
    }),
  );
});

// Abonnement invalidé (utilisateur a désinstallé, endpoint expiré...)
self.addEventListener("pushsubscriptionchange", (event: any) => {
  event.waitUntil(
    (async () => {
      // Le client re-souscrira via le hook au prochain chargement
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.postMessage({ type: "PUSH_SUBSCRIPTION_EXPIRED" });
      }
    })(),
  );
});
