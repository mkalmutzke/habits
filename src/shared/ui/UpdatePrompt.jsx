import { useRegisterSW } from 'virtual:pwa-register/react'

// Registers the service worker (only in the built app) and offers to reload
// when a new version has been downloaded (no surprise reloads).
function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <div className="update-prompt" role="status">
      <span>A new version of the app is ready.</span>
      <button type="button" className="button-ghost" onClick={() => setNeedRefresh(false)}>
        Later
      </button>
      <button type="button" className="button-primary" onClick={() => updateServiceWorker(true)}>
        Update
      </button>
    </div>
  )
}

export default UpdatePrompt
