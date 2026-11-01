import { addDays, formatShortDate, formatWeekday, toTimeKey } from '../../shared/utils/date.js'

// The daily briefs (v3.6): plain helpers behind the brief windows, no React.

// What each brief is called, its icon and the line at the bottom of its window.
export const BRIEFS = {
  ibkr: {
    title: 'Morning brief',
    settingsLabel: 'IBKR morning brief',
    icon: 'newspaper',
    setting: 'brief_ibkr_on',
    schedule: 'Tue–Sat 08:00',
    footer: 'Headlines only – no advice, no account figures.',
  },
  jobs: {
    title: 'Canada jobs brief',
    settingsLabel: 'Canada jobs brief',
    icon: 'briefcase',
    setting: 'brief_jobs_on',
    schedule: 'Every day 08:00',
    footer: 'No legal or tax advice – just what is worth looking into.',
  },
  world: {
    title: 'World news',
    settingsLabel: 'World news',
    icon: 'globe',
    setting: 'brief_world_on',
    schedule: 'Every day 08:00',
    footer: 'The most important headlines of the last 24 hours.',
  },
}

// Is the brief switched on in Settings? (on unless switched off)
export const isOn = (settings, kind) => settings?.[BRIEFS[kind].setting] !== false

// The amber dot: today's brief has arrived and wasn't opened yet today.
export const isNew = (brief, today) => Boolean(brief) && brief.for_day === today && brief.seen_on !== today

// The small line under the window's title: when the brief was made – and,
// if it isn't today's (a run failed, or IBKR on Sunday/Monday), from when.
export function briefDate(brief, today) {
  if (!brief) return null
  const time = brief.updated_at ? toTimeKey(new Date(brief.updated_at)) : null
  const day = `${formatWeekday(brief.for_day)} ${formatShortDate(brief.for_day)}`
  if (brief.for_day === today) return time ? `Today · ${time}` : 'Today'
  if (brief.for_day === addDays(today, -1)) return `From yesterday · ${day}`
  return `From ${day}`
}

// Number of headlines in a brief.
export const itemCount = (content) => (content?.sections ?? []).reduce((sum, section) => sum + (section.items?.length ?? 0), 0)
