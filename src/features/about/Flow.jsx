// Small building blocks for the architecture diagrams: boxes ("nodes") joined
// by labelled arrows ("links"). They are an ordered list, so screen readers
// read them as a sequence: box, how it connects, next box.

// zone: 'build' | 'runtime' | 'data' – picks the colour stripe of the box.
export function FlowNode({ icon, title, detail, zone, tag }) {
  return (
    <div className={`flow-node zone-${zone}`}>
      <span className="flow-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="flow-text">
        <span className="flow-title">
          {title}
          {tag && <span className="flow-tag">{tag}</span>}
        </span>
        {detail && <span className="flow-detail">{detail}</span>}
      </span>
    </div>
  )
}

// direction: 'down' (one way) or 'both' (requests and answers).
export function FlowLink({ label, direction = 'down' }) {
  return (
    <div className="flow-link">
      <span className="flow-arrow" aria-hidden="true">
        {direction === 'both' ? '⇅' : '↓'}
      </span>
      <span className="flow-link-label">{label}</span>
    </div>
  )
}

// Renders a list of { node } / { link } items as a vertical flow.
export function Flow({ items, label }) {
  return (
    <ol className="flow" aria-label={label}>
      {items.map((item, index) => (
        <li key={index} className="flow-step" style={{ '--i': index }}>
          {item.link ? <FlowLink {...item.link} /> : <FlowNode {...item.node} />}
        </li>
      ))}
    </ol>
  )
}

const ZONES = [
  { id: 'build', label: 'Build & deploy' },
  { id: 'runtime', label: 'In your browser' },
  { id: 'data', label: 'Data & sign-in' },
]

export function ZoneLegend() {
  return (
    <ul className="zone-legend" aria-label="Colours">
      {ZONES.map((zone) => (
        <li key={zone.id} className={`zone-${zone.id}`}>
          <span className="zone-swatch" aria-hidden="true" />
          {zone.label}
        </li>
      ))}
    </ul>
  )
}
