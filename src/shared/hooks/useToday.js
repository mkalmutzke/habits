import { useEffect, useState } from 'react'
import { toDateKey } from '../utils/date.js'

const CHECK_EVERY_MS = 30_000

// Today's date key on the local clock. It updates itself when midnight passes,
// so the header, streaks and checkmarks stay right if the app is left open
// overnight. Phones pause timers while asleep, so it also re-checks the moment
// the app comes back into view.
export function useToday() {
  const [today, setToday] = useState(() => toDateKey())

  useEffect(() => {
    const check = () => setToday(toDateKey())
    const onVisible = () => document.visibilityState === 'visible' && check()
    const timer = setInterval(check, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])

  return today
}
