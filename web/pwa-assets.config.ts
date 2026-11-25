import { defineConfig, type Preset } from '@vite-pwa/assets-generator/config'

/**
 * App icons. The padding around the gift is filled with the logo's own blush pink, never
 * white, so home-screen icons are one solid tile rather than a pink square on a white card.
 * Maskable (Android) keeps the gift inside the round safe zone; Apple only rounds the corners.
 */
const blush = '#FFE4EC'

const preset: Preset = {
  transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
  maskable: { sizes: [512], padding: 0.16, resizeOptions: { background: blush } },
  apple: { sizes: [180], padding: 0.18, resizeOptions: { background: blush } },
}

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset,
  images: ['public/logo.svg'],
})
