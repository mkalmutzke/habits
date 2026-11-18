import { addDays } from '../../shared/utils/date.js'

export const MILESTONES = [7, 30, 100]

// v3.8 (owner): three breaks in a row reset the streak.
export const MAX_BREAKS_IN_A_ROW = 3

// Number of days in a row the habit was completed, counting back from today.
// If today isn't checked yet, the streak is still alive and counts back from
// yesterday - it only drops to 0 once a whole day (yesterday) was missed.
// v3.8 (owner): `breaks` are days marked as a break. A break keeps the streak
// alive but doesn't add to it (a 20-day streak means 20 days actually done);
// the third break in a row ends it, so the streak only counts the done days
// after those breaks.
export function getStreak(completions, todayKey, breaks = []) {
  return walkBack(completions, todayKey, breaks).streak
}

// v3.8: is the habit on a break right now – the newest marked day (today, or
// yesterday while today is still open) is a break and the streak is alive?
export function isOnBreak(completions, todayKey, breaks = []) {
  return walkBack(completions, todayKey, breaks).onBreak
}

function walkBack(completions, todayKey, breaks) {
  const done = new Set(completions)
  const resting = new Set(breaks)
  const marked = (day) => done.has(day) || resting.has(day)
  let day = marked(todayKey) ? todayKey : addDays(todayKey, -1)
  const onBreak = resting.has(day) && !done.has(day)
  let streak = 0
  let breaksInARow = 0
  while (marked(day)) {
    if (done.has(day)) {
      streak += 1
      breaksInARow = 0
    } else {
      breaksInARow += 1
      if (breaksInARow >= MAX_BREAKS_IN_A_ROW) return { streak, onBreak: onBreak && streak > 0 }
    }
    day = addDays(day, -1)
  }
  return { streak, onBreak: onBreak && streak > 0 }
}

// The highest milestone reached (0 if none yet): 0, 7, 30 or 100.
export function getMilestone(streak) {
  return MILESTONES.filter((milestone) => streak >= milestone).at(-1) ?? 0
}
