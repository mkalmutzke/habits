import { useOnline } from '../../shared/data/hooks.js'
import Icon from '../../shared/ui/Icon.jsx'
import { defaultChannels, defaultRemindAt, describeReminder, fromLocalInputValue, toLocalInputValue } from './reminderTime.js'

const CHANNELS = [
  ['inapp', 'In app'],
  ['push', 'Push'],
  ['email', 'Email'],
]

const STATUS_TEXT = {
  sent: 'Sent',
  failed: 'Couldn’t be sent',
  cancelled: 'Not sent – task was done',
}

// "Remind me" in the task details (mockup 4): time and channels.
// A new reminder starts at the default time with the channels that are on.
function ReminderRow({ task, reminder, settings, pushOnThisDevice, onSet, onRemove }) {
  const online = useOnline()
  if (!reminder) {
    return (
      <button
        type="button"
        className="detail-row action"
        onClick={() =>
          onSet(task.id, {
            remind_at: defaultRemindAt(new Date(), settings.default_remind_time).toISOString(),
            channels: defaultChannels(settings, pushOnThisDevice),
          })
        }
        disabled={!online || task.completed_at !== null}
      >
        <BellIcon />
        <span>Remind me</span>
      </button>
    )
  }

  function toggleChannel(channel) {
    const next = reminder.channels.includes(channel)
      ? reminder.channels.filter((item) => item !== channel)
      : [...reminder.channels, channel]
    if (next.length) onSet(task.id, { channels: next })
  }

  const statusText = STATUS_TEXT[reminder.status]

  return (
    <div className="reminder-block">
      <div className="detail-row">
        <BellIcon active />
        <label className="detail-row-label reminder-label" htmlFor="remind-at">
          Remind me {describeReminder(reminder.remind_at)}
          {statusText && <span className={`reminder-status status-${reminder.status}`}>{statusText}</span>}
        </label>
        <button type="button" className="row-clear" aria-label="Remove reminder" onClick={() => onRemove(task.id)} disabled={!online}>
          ×
        </button>
      </div>
      <div className="reminder-time">
        <input
          id="remind-at"
          type="datetime-local"
          className="input compact"
          value={toLocalInputValue(reminder.remind_at)}
          onChange={(event) => {
            const iso = fromLocalInputValue(event.target.value)
            if (iso) onSet(task.id, { remind_at: iso })
          }}
          disabled={!online}
        />
      </div>
      <div className="channel-chips" role="group" aria-label="Remind me by">
        {CHANNELS.map(([channel, label]) => (
          <button
            key={channel}
            type="button"
            className="chip chip-teal"
            aria-pressed={reminder.channels.includes(channel)}
            onClick={() => toggleChannel(channel)}
            disabled={!online}
          >
            {label}
          </button>
        ))}
      </div>
      {reminder.channels.includes('push') && !pushOnThisDevice && (
        <p className="settings-hint reminder-hint">
          Push reaches the devices where it’s switched on in <a href="#/settings">Settings</a>.
        </p>
      )}
    </div>
  )
}

function BellIcon({ active = false }) {
  return (
    <Icon name="alarm" className={active ? 'icon-teal' : undefined} />
  )
}

export default ReminderRow
