const CHANNELS = [
  ['inapp', 'In app'],
  ['push', 'Push'],
  ['email', 'Email'],
]

// "Daily reminder" in the habit dialog: a switch, then time and channels.
// `reminder` is what useReminderDraft returns. It is sent only if the habit
// isn't done yet that day.
function HabitReminderFields({ reminder, pushOnThisDevice }) {
  const { on, setOn, time, timeRef, readTime, channels, toggleChannel } = reminder
  return (
    <div className="habit-reminder">
      <div className="habit-reminder-head">
        <span className="habit-reminder-text">
          <span id="habit-reminder-label">Daily reminder</span>
          <span className="settings-hint">Only if not done yet that day</span>
        </span>
        {/* same switch as in Settings (a toggle button) */}
        <button type="button" className="switch" aria-pressed={on} aria-labelledby="habit-reminder-label" onClick={() => setOn(!on)} />
      </div>
      {on && (
        <>
          <label className="habit-reminder-row">
            <span>Time</span>
            <input
              ref={timeRef}
              type="time"
              className="input compact"
              defaultValue={time}
              onChange={(event) => readTime(event.target.value)}
              onInput={(event) => readTime(event.currentTarget.value)}
              onBlur={(event) => readTime(event.target.value)}
              aria-describedby="habit-reminder-summary"
              required
            />
          </label>
          {/* what will be saved – visible before Save */}
          <p id="habit-reminder-summary" className="settings-hint" aria-live="polite">
            Daily at {time}, only if not done yet
          </p>
          <div className="channel-chips" role="group" aria-label="Remind me by">
            {CHANNELS.map(([channel, label]) => (
              <button key={channel} type="button" className="chip chip-teal" aria-pressed={channels.includes(channel)} onClick={() => toggleChannel(channel)}>
                {label}
              </button>
            ))}
          </div>
          {channels.includes('push') && !pushOnThisDevice && (
            <p className="settings-hint">
              Push reaches the devices where it’s switched on in <a href="#/settings">Settings</a>.
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default HabitReminderFields
