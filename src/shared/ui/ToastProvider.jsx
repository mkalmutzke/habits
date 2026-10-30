import { useCallback, useMemo, useRef, useState } from 'react'
import { ToastContext } from './toast.js'
import './Toast.css'

const SHOW_MS = 5000

// options: { tone: 'info' | 'error' | 'reminder', action: { label, onClick }, sticky }
// Sticky toasts (reminders) stay until closed. Screen readers announce every
// toast through the live region.
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (text, options = {}) => {
      const id = nextId.current++
      setToasts((current) => [...current.filter((toast) => toast.text !== text), { id, text, ...options }].slice(-3))
      if (!options.sticky) setTimeout(() => dismiss(id), SHOW_MS)
      return id
    },
    [dismiss],
  )

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast tone-${toast.tone ?? 'info'}`}>
            <span className="toast-text">{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action.onClick()
                  dismiss(toast.id)
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              className="toast-close"
              aria-label="Close message"
              onClick={() => dismiss(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export default ToastProvider
