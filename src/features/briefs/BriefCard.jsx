import { useId, useState } from 'react'
import { useSectionOpen } from '../../shared/hooks/useSectionOpen.js'
import Icon from '../../shared/ui/Icon.jsx'
import { BRIEF_LISTS, BRIEF_TOPICS, LIMITS } from '../../../supabase/functions/_shared/briefPrefs.js'
import SwitchRow from '../settings/SwitchRow.jsx'
import { BRIEFS, briefPrefs, briefTitle, isOn } from './briefs.js'
import ListField from './ListField.jsx'

const COUNTS = Array.from({ length: LIMITS.maxItems - LIMITS.minItems + 1 }, (_, index) => LIMITS.minItems + index)

// v3.9 (owner): one brief in Settings → Daily briefs – a foldable bar with its
// name and run switch; opened, everything that decides its content: icon,
// title, lists, topics, number of items, "about me" (jobs) and anything else
// to follow. Each change is saved at once (texts when the field is left) and
// the next morning run uses it.
function BriefCard({ kind, settings, update, disabled }) {
  const [open, setOpen] = useSectionOpen(`brief-prefs-${kind}`)
  const id = useId()
  const prefs = briefPrefs(settings, kind)
  const on = isOn(settings, kind)
  const name = briefTitle(settings, kind, { forSettings: true })

  // built on the newest settings, also changes still on their way (a quick
  // second change must not undo the first)
  function save(patch) {
    update((current) => {
      const base = briefPrefs(current, kind)
      const values = typeof patch === 'function' ? patch(base) : patch
      return { brief_prefs: { ...(current.brief_prefs ?? {}), [kind]: { ...base, ...values } } }
    })
  }

  function toggleTopic(key) {
    save((base) => ({ topics: base.topics.includes(key) ? base.topics.filter((other) => other !== key) : [...base.topics, key] }))
  }

  return (
    <div className={open ? 'brief-card-settings open' : 'brief-card-settings'}>
      <div className="brief-card-head">
        <button type="button" className="brief-card-toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen(!open)}>
          <span className="settings-row-text">
            <span className="settings-row-label">{name}</span>
            <span className="settings-hint">{on ? `${BRIEFS[kind].schedule} · ${prefs.icon ? 'icon shown' : 'icon hidden'}` : 'Off – no morning run'}</span>
          </span>
          <Icon name="chevronDown" className="section-chevron" />
        </button>
        <button type="button" className="switch" aria-pressed={on} aria-label={`${name} – run every morning`} onClick={() => update({ [BRIEFS[kind].setting]: !on })} disabled={disabled} />
      </div>

      {open && (
        <div id={`${id}-body`} className="brief-card-body">
          <SwitchRow label="Show its icon" hint={prefs.icon ? 'In the header (IBKR: on the IBKR card)' : 'Hidden – the brief still runs if it is on'} on={prefs.icon} onToggle={() => save({ icon: !prefs.icon })} disabled={disabled} />
          <TextSetting label="Name" value={prefs.title} placeholder={briefTitle({ ...settings, brief_prefs: { [kind]: { ...prefs, title: '' } } }, kind)} max={LIMITS.title} onSave={(title) => save({ title })} disabled={disabled} />
          {Object.entries(BRIEF_LISTS[kind]).map(([field, list]) => (
            <ListField key={field} label={list.label} values={prefs[field]} placeholder={list.placeholder} ticker={list.ticker} onChange={(values) => save({ [field]: values })} disabled={disabled} />
          ))}
          <div className="brief-field">
            <span className="brief-field-label" id={`${id}-topics`}>
              Topics
            </span>
            <div className="brief-topics" role="group" aria-labelledby={`${id}-topics`}>
              {BRIEF_TOPICS[kind].map(([key, label]) => (
                <button key={key} type="button" className="brief-topic" aria-pressed={prefs.topics.includes(key)} onClick={() => toggleTopic(key)} disabled={disabled}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="brief-field brief-count">
            <label className="brief-field-label" htmlFor={`${id}-max`}>
              Items at most
            </label>
            <select id={`${id}-max`} className="input compact" value={prefs.max} onChange={(event) => save({ max: Number(event.target.value) })} disabled={disabled}>
              {COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>
          {'about' in prefs && (
            <TextSetting label="About me" hint="Your background and plans, so the brief knows what matters. Empty: the text in the brief's instructions." value={prefs.about} max={LIMITS.about} multiline onSave={(about) => save({ about })} disabled={disabled} />
          )}
          <TextSetting label="Also follow" hint="Anything else, in your own words – e.g. “SAP news in German-speaking countries”." value={prefs.extra} max={LIMITS.extra} multiline onSave={(extra) => save({ extra })} disabled={disabled} />
        </div>
      )}
    </div>
  )
}

// A text that is saved when the field is left (not on every key press).
function TextSetting({ label, hint, value, placeholder, max, multiline = false, onSave, disabled }) {
  const id = useId()
  const [draft, setDraft] = useState(value)
  const [shown, setShown] = useState(value)
  // a change from another device shows up here
  if (value !== shown) {
    setShown(value)
    setDraft(value)
  }
  const Field = multiline ? 'textarea' : 'input'
  return (
    <div className="brief-field">
      <label className="brief-field-label" htmlFor={id}>
        {label}
      </label>
      {hint && <span className="settings-hint">{hint}</span>}
      <Field
        id={id}
        className="input"
        value={draft}
        placeholder={placeholder}
        maxLength={max}
        rows={multiline ? 3 : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => draft.trim() !== value && onSave(draft.trim())}
        disabled={disabled}
      />
    </div>
  )
}

export default BriefCard
