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
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    ssr: {
      // Modules CJS ou avec interop cassée en SSR : les bundler évite les erreurs
      // "Cannot destructure property '__extends' of '__toESM(...).default'"
      // et les require/module non définis dans le runner SSR.
      noExternal: ["tslib", "pdf-lib", "pako", "@pdf-lib/standard-fonts", "@pdf-lib/upng"],
    },
  },
  plugins: [
    VitePWA({
      selfDestroying: true,
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/_serverFn\//],
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
                request.destination === "font" ||
                request.destination === "image"),
            handler: "CacheFirst",
            options: {
              cacheName: "agn-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
