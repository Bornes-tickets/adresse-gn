// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    ssr: {
      // tslib doit rester bundlé (interop __extends cassée sinon).
      noExternal: ["tslib"],
    },
  },
  plugins: [
    VitePWA({
      // On désactive selfDestroying pour que le SW cache vraiment (installation possible).
      registerType: "autoUpdate",
      injectRegister: "auto",
      strategies: "generateSW",
      filename: "sw.js",
      devOptions: { enabled: false },
      // Le manifest est fourni via /public/manifest.webmanifest — on n'injecte pas ici.
      manifest: false,
      // Inclut les icônes et le manifest dans le précache
      includeAssets: [
        "manifest.webmanifest",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-192.png",
        "icons/icon-maskable-512.png",
        "icons/apple-touch-icon-180.png",
      ],
      workbox: {
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2,webmanifest}"],
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/_serverFn\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Navigations : réseau d'abord (jamais cache-first sur du HTML).
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "agn-pages", networkTimeoutSeconds: 5 },
          },
          {
            // App shell : assets buildés et immuables.
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin &&
              (request.destination === "script" ||
                request.destination === "style" ||
                request.destination === "font"),
            handler: "CacheFirst",
            options: {
              cacheName: "agn-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Images (icônes, photos de balises stockées)
            urlPattern: ({ request }) => request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "agn-images",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
