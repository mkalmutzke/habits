// Short vibrations that make taps feel physical. Supported on most Android
// browsers; iPhone browsers don't let web pages vibrate, so there it does
// nothing (the on-screen "thump" animation carries the feel instead).
function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Some browsers throw when vibration isn't allowed - just skip it.
  }
}

// A habit checked off: one short, crisp tick.
export function hapticSuccess() {
  vibrate(12)
}

// A habit un-checked: an even lighter tick.
export function hapticLight() {
  vibrate(6)
}

// A milestone (7, 30, 100 days): tick - pause - tick.
export function hapticCelebrate() {
  vibrate([14, 60, 22])
}
