import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

/** Short commit id plus build date, shown in bug reports. */
function appVersion() {
  const date = new Date().toISOString().slice(0, 10)
  const ci = process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 7)
  if (ci) return `${ci} ${date}`
  try {
    return `${execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()} ${date}`
  } catch {
    return date
  }
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'GiftHub',
        short_name: 'GiftHub',
        description: 'A private shared wishlist for couples, friends and families.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FFE4EC',
        theme_color: '#FFE4EC',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. API calls to Supabase always go to the network.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        // The design prototype is its own page, not an app route.
        navigateFallbackDenylist: [/^\/demo/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
})
