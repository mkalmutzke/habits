import Icon from './Icon.jsx'

// "‹ Lists", "‹ Settings", … at the top left of a page that isn't a tab.
function BackLink({ href, children }) {
  return (
    <a className="back-link" href={href}>
      <Icon name="chevronLeft" size={18} outline />
      {children}
    </a>
  )
}

export default BackLink
