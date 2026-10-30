// Runs before every test file.
// Adds matchers like expect(element).toBeInTheDocument() and removes rendered
// components after each test, so tests never see each other's screens.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})
