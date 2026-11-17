import { registerSW } from 'virtual:pwa-register'

/**
 * Keeps the installed app current. A new version activates straight away and
 * the page reloads into it (registerType "autoUpdate"). Besides the check the
 * browser does on page load, it checks again whenever you come back to the tab
 * or app, so an open tab never gets stuck on an old version.
 */
export function startAutoUpdate() {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      let last = Date.now()
      const check = () => {
        // At most once a minute; skipped offline.
        if (document.visibilityState !== 'visible' || !navigator.onLine || Date.now() - last < 60_000) return
        last = Date.now()
        registration.update().catch(() => undefined)
      }
      document.addEventListener('visibilitychange', check)
      window.addEventListener('focus', check)
      window.addEventListener('online', check)
      // Long-open tabs also check every 30 minutes.
      setInterval(check, 30 * 60_000)
    },
  })
}
