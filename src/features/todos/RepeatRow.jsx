import { useOnline } from '../../shared/data/hooks.js'
import Icon from '../../shared/ui/Icon.jsx'
import { describeRule, presetOf, REPEAT_PRESETS, WEEKDAY_SHORT } from './repeat.js'

const PRESET_LABELS = { never: 'Never', daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly', custom: 'Custom…' }
const UNIT_LABELS = { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' }

// How a task repeats: a preset, or "Custom…" with interval, unit and weekdays.
function RepeatRow({ task, update }) {
  const online = useOnline()
  const rule = task.repeat_rule
  const preset = presetOf(rule)

  function choose(value) {
    if (value === 'never') update({ repeat_rule: null })
    else if (value === 'custom') update({ repeat_rule: { freq: 'weekly', interval: 2, weekdays: [] } })
    else update({ repeat_rule: REPEAT_PRESETS[value] })
  }

  // weekdays only belong to a weekly rule
  function changeCustom(values) {
    const next = { ...rule, ...values }
    if (next.freq !== 'weekly') delete next.weekdays
    update({ repeat_rule: next })
  }

  function toggleDay(day) {
    const days = rule.weekdays ?? []
    changeCustom({ weekdays: days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort() })
  }

  return (
    <div className="repeat-block">
      <div className="detail-row">
        <Icon name="repeat" />
        <label className="detail-row-label" htmlFor="repeat">
          {rule ? `Repeat · ${describeRule(rule)}` : 'Repeat'}
        </label>
        <select id="repeat" className="input compact" value={preset} onChange={(event) => choose(event.target.value)} disabled={!online}>
          {Object.entries(PRESET_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {preset === 'custom' && (
        <div className="custom-repeat">
          <label className="inline-field">
            <span>Every</span>
            <input
              type="number"
              className="input compact number"
              min={1}
              max={365}
              value={rule.interval ?? 1}
              onChange={(event) => changeCustom({ interval: Math.min(365, Math.max(1, Number(event.target.value) || 1)) })}
              disabled={!online}
            />
          </label>
          <select
            className="input compact"
            aria-label="Repeat unit"
            value={rule.freq}
            onChange={(event) => changeCustom({ freq: event.target.value })}
            disabled={!online}
          >
            {Object.entries(UNIT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {rule.freq === 'weekly' && (
            <div className="weekday-chips" role="group" aria-label="On these days">
              {WEEKDAY_SHORT.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  className="chip"
                  aria-pressed={rule.weekdays?.includes(day) ?? false}
                  onClick={() => toggleDay(day)}
                  disabled={!online}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RepeatRow
