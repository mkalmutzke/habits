import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable app: our own service worker (src/sw.js) gets the
    // list of built files to keep for offline starts, and handles push.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      manifest: {
        name: 'Habits',
        short_name: 'Habits',
        description: 'Habits and to-dos, on every device.',
        start_url: '/#/today',
        scope: '/',
        display: 'standalone',
        background_color: '#13120f',
        theme_color: '#13120f',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    // The app uses the device's local time zone. Tests pin
    // one, so their results are the same on every computer.
    env: { TZ: 'Europe/Zurich' },
    // Unit and component tests. Component tests switch to a simulated browser
    // with a `// @vitest-environment jsdom` line at the top of the file.
    include: ['src/**/*.test.{js,jsx}', 'supabase/functions/_shared/**/*.test.js'],
    setupFiles: ['./src/test/setup.js'],
  },
})
