// The app's line icons in one place (24 × 24, drawn with the text colour by
// the CSS of the place they're used in). Always decorative: the button or
// link around an icon carries the label.
const ICONS = {
  plus: <path d="M12 6v12M6 12h12" />,
  plusLarge: <path d="M12 5v14M5 12h14" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  calendar: <path d="M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />,
  repeat: <path d="M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 20 20 4" />
    </>
  ),
  alarm: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3" />
    </>
  ),
  // v3.6: habits shown in groups / as one list
  groups: (
    <>
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
    </>
  ),
  list: <path d="M4 6h16M4 12h16M4 18h16" />,
  // v3.6: header and brief icons
  run: (
    <>
      <circle cx="14" cy="4" r="2" />
      <path d="M8 21l3-6 3 2v4M6 12l3-4 4 1 3 4h3" />
    </>
  ),
  newspaper: <path d="M4 5h13v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM17 9h3v10a2 2 0 0 1-2 2M7 9h7M7 13h7M7 17h4" />,
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
    </>
  ),
  refresh: <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />,
}

// Icons outside a styled button (back link, settings arrow) bring their own
// size and line style: `size` in px, `outline` for a 2px round stroke.
const OUTLINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

// <Icon name="plus" />; other props (className, …) go to the <svg>.
// `path` draws any other single path (e.g. the smart-list icons).
function Icon({ name, path, size, outline = false, ...props }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={size} height={size} {...(outline ? OUTLINE : {})} {...props}>
      {path ? <path d={path} /> : ICONS[name]}
    </svg>
  )
}

export default Icon
