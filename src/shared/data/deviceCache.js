const PREFIX = 'habits-v2-cache:'

// Where the read-only device copy of a user's data is saved.
export function cacheKey(userId) {
  return `${PREFIX}${userId}`
}

// Removes every saved copy on this device. Called whenever nobody is signed in,
// so the next person on this device sees nothing of the previous one.
// The copy is saved at most once a second, so a save that was already on its
// way when signing out is removed by a second pass shortly after.
export function clearDeviceCaches() {
  removeAll()
  setTimeout(removeAll, 1500)
}

function removeAll() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(PREFIX)) window.localStorage.removeItem(key)
    }
  } catch {
    // storage unavailable: nothing was saved either
  }
}

