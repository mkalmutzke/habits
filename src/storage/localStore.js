// The only two functions in the app that touch localStorage directly (apart
// from the data layer's read-only device copy, src/shared/data/DataProvider.jsx).
// Both fail quietly: storage can be unavailable (e.g. some private modes),
// and the app still works for that visit.
export function readItem(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeItem(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
