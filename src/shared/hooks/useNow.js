import { useEffect, useState } from 'react'

// v3.8: the current time, updated every `everyMs` (default: a minute) and when
// the app comes back into view – for things that change with time alone,
// like "no report for 15 minutes" (server health).
export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
    const onVisible = () => document.visibilityState === 'visible' && tick()
    const timer = setInterval(tick, everyMs)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [everyMs])

  return now
}
