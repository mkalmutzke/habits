import { createContext, useContext } from 'react'

// Short messages at the bottom of the screen ("Couldn't save", reminders …).
// The provider is ToastProvider.jsx; components call useToast().show(text, options).
export const ToastContext = createContext({ show: () => {}, dismiss: () => {} })

export function useToast() {
  return useContext(ToastContext)
}
