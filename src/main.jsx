import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (same families as cv.mkalmutzke.com)
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/archivo/400.css'
import '@fontsource/archivo/500.css'
import '@fontsource/archivo/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './shared/styles/base.css'
import './shared/styles/buttons.css'
import './shared/styles/forms.css'
import App from './App.jsx'
import ToastProvider from './shared/ui/ToastProvider.jsx'
import UpdatePrompt from './shared/ui/UpdatePrompt.jsx'
import './features/notifications/notifications.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
      <UpdatePrompt />
    </ToastProvider>
  </StrictMode>,
)
