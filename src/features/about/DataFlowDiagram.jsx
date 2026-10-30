// What happens when you tick a habit (or change anything else).
const DEVICE_STEPS = [
  { who: 'You', zone: 'runtime', text: 'Tap a day in the habit grid' },
  { who: 'App', zone: 'runtime', text: 'Shows the tick at once (optimistic) – no waiting for the network' },
  { who: 'App', zone: 'runtime', text: 'Queues the change; saves go out one after another, in order' },
]

const CLOUD_STEPS = [
  { who: 'Cloud', zone: 'data', text: 'Saves one row (insert habit_completions) – row level security checks it is yours' },
  { who: 'Cloud', zone: 'data', text: 'A trigger broadcasts the change to your private channel user:<your id>' },
  { who: 'Devices', zone: 'runtime', text: 'Your other open devices reload that table – updated within a second' },
  { who: 'App', zone: 'runtime', text: 'If the save failed: the tick is undone and a message says why' },
]

function Steps({ steps, start }) {
  return steps.map((step, index) => (
    <li key={index} className={`data-step zone-${step.zone}`} style={{ '--i': start + index }}>
      <span className="data-num" aria-hidden="true">
        {start + index + 1}
      </span>
      <span className="data-who">{step.who}</span>
      <span className="data-text">{step.text}</span>
    </li>
  ))
}

function DataFlowDiagram() {
  return (
    <>
      <p className="arch-intro">
        The cloud is the only real copy. The app shows a change at once and saves it
        in the background; offline you can look at everything, but not change it.
      </p>
      <ol className="data-steps" aria-label="What happens when you tick a habit">
        <Steps steps={DEVICE_STEPS} start={0} />
        <li className="data-divider" style={{ '--i': DEVICE_STEPS.length }}>
          Over HTTPS, straight away
        </li>
        <Steps steps={CLOUD_STEPS} start={DEVICE_STEPS.length} />
      </ol>
      <p className="arch-format">
        <span className="arch-format-label">On opening the app</span>
        <code>device copy (≤ 7 days) shown at once → every table loaded fresh → live updates from then on</code>
      </p>
    </>
  )
}

export default DataFlowDiagram
