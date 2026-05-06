import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/arbeits-dashboard/",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.svg"],
      manifest: {
        name: "Arbeits-Dashboard",
        short_name: "Arbeit",
        description: "Lokales Dashboard fuer Zeiterfassung, Gleitzeit und Urlaub.",
        theme_color: "#f7f8fa",
        background_color: "#f7f8fa",
        display: "standalone",
        scope: "/arbeits-dashboard/",
        start_url: "/arbeits-dashboard/#/",
        icons: [
          {
            src: "pwa-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any maskable"
          },
          {
            src: "pwa-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,ico}"],
        navigateFallback: null
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          storage: ["dexie", "jszip"],
          pwa: ["workbox-window"]
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
