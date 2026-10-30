import { addDays } from '../../shared/utils/date.js'

export const MILESTONES = [7, 30, 100]

// Number of days in a row the habit was completed, counting back from today.
// If today isn't checked yet, the streak is still alive and counts back from
// yesterday - it only drops to 0 once a whole day (yesterday) was missed.
export function getStreak(completions, todayKey) {
  const done = new Set(completions)
  let day = done.has(todayKey) ? todayKey : addDays(todayKey, -1)
  let streak = 0
  while (done.has(day)) {
    streak += 1
    day = addDays(day, -1)
  }
  return streak
}

// The highest milestone reached (0 if none yet): 0, 7, 30 or 100.
export function getMilestone(streak) {
  return MILESTONES.filter((milestone) => streak >= milestone).at(-1) ?? 0
}
