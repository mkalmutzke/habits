import { useSyncExternalStore } from 'react'

// A tiny router based on the part of the address after "#" (design §3.3):
//   #/today  #/dawn  #/lists  #/list/<source>  #/task/<id>  #/settings
// v3.8: the Week page is called Dawn (#/dawn); old #/week links still open it.
//   #/task/new?source=<source>   (v3: add a task – details open at once)
// Hash addresses never reach the server, so links from a push notification
// (#/task/<id>) work without any server setup.
const VIEWS = ['today', 'dawn', 'lists', 'list', 'task', 'settings']
// old addresses that still work
const RENAMED = { week: 'dawn' }

export function parseRoute(hash) {
  const [path, search = ''] = hash.replace(/^#\/?/, '').split('?')
  const [first, id] = path.split('/')
  const view = RENAMED[first] ?? first
  const query = Object.fromEntries(new URLSearchParams(search))
  if (!VIEWS.includes(view)) return { view: 'today', id: null, query }
  if ((view === 'list' || view === 'task') && !id) return { view: 'lists', id: null, query }
  return { view, id: id ? decodeURIComponent(id) : null, query }
}

function subscribe(onChange) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '')
  return parseRoute(hash)
}

export function navigate(path) {
  window.location.hash = path
}
