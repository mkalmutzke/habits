import { useEffect, useMemo, useState } from 'react'
import { insert, newId, remove, update } from '../../shared/data/changes.js'
import { useSave, useTable } from '../../shared/data/hooks.js'
import { navigate } from '../../shared/hooks/useRoute.js'
import { useToast } from '../../shared/ui/toast.js'
import { hapticCelebrate } from '../../shared/utils/haptics.js'
import { toDateKey } from '../../shared/utils/date.js'
import { readItem, writeItem } from '../../storage/localStore.js'
import { currentSubscription } from './pushDevice.js'
import { describeReminder, habitShownKey, isDueInApp, isHabitDueInApp } from './reminderTime.js'

// Reminders of tasks (table todo_reminders, one per task) and how the app
// sets, changes and removes them.
export function useReminders(userId) {
  const { rows } = useTable('todo_reminders')
  const save = useSave()
  const byTask = useMemo(() => new Map(rows.map((row) => [row.task_id, row])), [rows])

  // `values` holds only what changed – { remind_at } or { channels } – so a
  // quick second change can't put back an older value of the other field
  // (Step 149); a new reminder gets both. Only time and channels: the status
  // belongs to the server.
  function setReminder(taskId, values) {
    const existing = byTask.get(taskId)
    save(
      existing
        ? update('todo_reminders', existing.id, values)
        : insert('todo_reminders', { id: newId(), user_id: userId, task_id: taskId, ...values }),
    )
  }

  function removeReminder(taskId) {
    const existing = byTask.get(taskId)
    if (existing) save(remove('todo_reminders', existing.id))
  }

  // Small label for task rows: only for reminders that are still to come.
  function reminderText(task) {
    const reminder = byTask.get(task.id)
    if (!reminder || task.completed_at || task.deleted_at || !['pending', 'sending'].includes(reminder.status)) return null
    return describeReminder(reminder.remind_at)
  }

  return { reminders: rows, byTask, setReminder, removeReminder, reminderText }
}

// Does this device currently have push switched on?
export function usePushOnThisDevice(subscriptions) {
  const [endpoint, setEndpoint] = useState(null)
  useEffect(() => {
    let active = true
    currentSubscription()
      .then((subscription) => active && setEndpoint(subscription?.endpoint ?? null))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [subscriptions])
  return Boolean(endpoint && subscriptions.some((row) => row.endpoint === endpoint))
}

const SHOWN_KEY = 'habits.inapp-reminders-shown'
const CHECK_EVERY_MS = 15_000

function loadShown() {
  try {
    return new Set(JSON.parse(readItem(SHOWN_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

// In-app reminders: while the app is open it checks every few seconds and
// shows a banner when a reminder is due (design §6, no server involved).
// Each reminder is shown once per device. v3: habit reminders too, once a day.
export function useInAppReminders({ reminders, tasks, habitReminders = [], habits = [], inappOn }) {
  const toast = useToast()

  useEffect(() => {
    if (!inappOn) return
    function check() {
      const shown = loadShown()
      const now = new Date()
      for (const reminder of reminders) {
        const task = tasks.find((item) => item.id === reminder.task_id)
        if (!isDueInApp(reminder, task, now, shown)) continue
        shown.add(`${reminder.id}@${reminder.remind_at}`)
        hapticCelebrate()
        toast.show(`⏰ ${task.title}`, {
          tone: 'reminder',
          sticky: true,
          action: { label: 'Open', onClick: () => navigate(`/task/${task.id}`) },
        })
      }
      for (const reminder of habitReminders) {
        const habit = habits.find((item) => item.id === reminder.habit_id)
        if (!isHabitDueInApp(reminder, habit, now, shown)) continue
        shown.add(habitShownKey(reminder, toDateKey(now)))
        hapticCelebrate()
        toast.show(`⏰ ${habit.emoji} ${habit.name} – not done yet today`, {
          tone: 'reminder',
          sticky: true,
          action: { label: 'Open', onClick: () => navigate('/today') },
        })
      }
      // keep the list short
      writeItem(SHOWN_KEY, JSON.stringify([...shown].slice(-200)))
    }
    check()
    const timer = setInterval(check, CHECK_EVERY_MS)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reminders, tasks, habitReminders, habits, inappOn, toast])
}
