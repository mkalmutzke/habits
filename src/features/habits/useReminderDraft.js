import { useRef, useState } from 'react'
import { toTimeInputValue } from '../notifications/reminderTime.js'

const TIME = /^\d{2}:\d{2}/

// The daily reminder being edited in the habit dialog (v3 H6, D3): on/off,
// time and channels. `value()` is what gets saved – { remind_time, channels }
// or null when the reminder is off.
export function useReminderDraft(initialReminder, defaultTime, defaultChannels) {
  const timeRef = useRef(null)
  const [on, setOn] = useState(Boolean(initialReminder?.active ?? initialReminder))
  const [time, setTime] = useState(toTimeInputValue(initialReminder?.remind_time ?? defaultTime))
  const [channels, setChannels] = useState(initialReminder?.channels ?? defaultChannels)

  // The time field is uncontrolled: the field itself holds the value. Chrome
  // on Android doesn't always report a time picked in its picker inside a
  // dialog (owner's production test, v3.0.2); a controlled field would then
  // be reset to the old time on the next render. So: follow every event we
  // get, and read the field itself once more when saving.
  function readTime(value) {
    if (TIME.test(value ?? '')) setTime(value.slice(0, 5))
  }

  function currentTime() {
    const value = timeRef.current?.value
    return TIME.test(value ?? '') ? value.slice(0, 5) : time
  }

  // at least one channel stays on
  function toggleChannel(channel) {
    const next = channels.includes(channel) ? channels.filter((item) => item !== channel) : [...channels, channel]
    if (next.length) setChannels(next)
  }

  const value = () => (on ? { remind_time: `${currentTime()}:00`, channels } : null)

  return { on, setOn, time, timeRef, readTime, channels, toggleChannel, value }
}
