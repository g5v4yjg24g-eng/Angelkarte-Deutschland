/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fishGroup } from './scripts/brand.mjs';

// BASE_PATH z. B. "/Angelkarte-Deutschland/" für GitHub Pages; lokal "/".
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') },
  plugins: [
    react(),
    {
      // Intro-Fisch aus dem Marken-Master (src/design/brand/fish.json) in index.html einsetzen.
      name: 'fangpunkt-intro-fish',
      transformIndexHtml: (html) => html.replace('<!--FISH-->', fishGroup({ scale: 1, classes: true })),
    },
    VitePWA({
      // Neue Version wird im Hintergrund geladen; die App fragt, bevor sie neu lädt (ARCHITECTURE §7.1).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Fangpunkt',
        short_name: 'Fangpunkt',
        description: 'Gewässer finden, Angelstellen merken, Fänge dokumentieren – in ganz Deutschland.',
        lang: 'de',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0B2A33',
        theme_color: '#0B2A33',
        categories: ['sports', 'lifestyle', 'navigation'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: { include: [/tokens\.css/] },
  },
});
