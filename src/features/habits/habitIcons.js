// The four habit icons (owner decision D4, design v3 §2.2).
export const HABIT_ICONS = [
  { emoji: '🐕', label: 'Dog' },
  { emoji: '🏃', label: 'Sport' },
  { emoji: '💊', label: 'Medication' },
  { emoji: '✨', label: 'Other' },
]

// The choices for the dialog: the four icons, plus the habit's current emoji
// when it is an older one (so editing doesn't change it by accident).
export function iconChoices(currentEmoji) {
  const known = HABIT_ICONS.some((icon) => icon.emoji === currentEmoji)
  return known || !currentEmoji ? HABIT_ICONS : [...HABIT_ICONS, { emoji: currentEmoji, label: 'Current' }]
}
