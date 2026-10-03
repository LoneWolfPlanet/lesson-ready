import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "LessonReady",
        short_name: "LessonReady",
        description: "Ready-to-teach lesson packs in a few minutes.",
        theme_color: "#1f6f5c",
        background_color: "#f7f6f2",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The app shell is cached by the service worker. Pack content is cached
        // by the app itself (src/api/offlineCache.ts), so API calls are not
        // cached here and always try the network first.
        navigateFallback: "/index.html",
        // The redirect bridge must never be served from the app-shell fallback.
        navigateFallbackDenylist: [/^\/redirect\.html/],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // The fake API (mock mode only) is never needed offline in a real build.
        globIgnores: ["**/mockServer-*.js"],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        redirect: resolve(__dirname, "redirect.html"),
      },
      output: {
        // Libraries in their own files: they change rarely, so browsers keep them cached
        // across app deploys and only the small app chunk is downloaded again.
        // MSAL is left to Rollup on purpose: forcing it into one chunk would make the tiny
        // sign-in redirect page (redirect.html) download all of MSAL.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/](react-router|react-router-dom)[\\/]/.test(id)) return "router";
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
          return undefined;
        },
      },
    },
  },
  server: { port: 5173 },
});
