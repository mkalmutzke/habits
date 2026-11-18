// v3.8 (owner): which modules the app shows (Settings → Modules). Plain
// helpers, no React. The defaults are what v3.7 showed.

export const GARMIN_CHOICES = [
  { id: 'off', label: 'Off' },
  { id: 'icon', label: 'Icon' },
  { id: 'section', label: 'Section' },
]

// 'off' | 'icon' | 'section'
export const garminDisplay = (settings) => (['off', 'icon', 'section'].includes(settings?.garmin_display) ? settings.garmin_display : 'icon')

// Is the IBKR card shown on What's up?
export const ibkrShown = (settings) => settings?.ibkr_display !== 'off'

// The line under each module's name in Settings.
export const GARMIN_HINTS = {
  off: 'Hidden everywhere',
  icon: 'Icon in the header, opens a window',
  section: 'A card on What’s up?, under IBKR',
}

// v3.8: the server health icon in the header (off to start with).
export const serverShown = (settings) => settings?.server_display === 'icon'

// v3.9: the Calendar card on Dawn (on to start with).
export const calendarShown = (settings) => settings?.calendar_display !== 'off'
