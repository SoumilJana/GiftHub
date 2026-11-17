import { useRegisterSW } from 'virtual:pwa-register/react'

/** Shows a "new version" toast when a new service worker is waiting. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[84px] z-20 mx-auto flex max-w-md items-center justify-between gap-4 rounded-full bg-plum px-5 py-3 text-small font-semibold text-white shell:bottom-6"
    >
      <span>A new version of GiftHub is ready.</span>
      <span className="flex gap-3">
        <button type="button" className="font-semibold underline underline-offset-3" onClick={() => updateServiceWorker(true)}>
          Refresh
        </button>
        <button type="button" className="text-white/70 hover:text-white" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </span>
    </div>
  )
}
