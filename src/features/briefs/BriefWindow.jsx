import { useEffect } from 'react'
import Modal from '../../shared/ui/Modal.jsx'
import { BRIEFS, briefDate } from './briefs.js'
import './briefs.css'

// One daily brief in a window (v3.6): IBKR morning brief, Canada jobs brief
// or world news. Headlines grouped under short headings, each a link to its
// source (opens in a new tab). Opening it marks it as seen for today.
function BriefWindow({ kind, brief, today, onSeen, onClose }) {
  const meta = BRIEFS[kind]
  const content = brief?.content

  // seen as soon as it is opened (the amber dot goes away on all devices)
  useEffect(() => {
    if (brief) onSeen(kind, today)
    // once per opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Modal open wide className={`brief-window brief-${kind}`} onClose={onClose} title={meta.title} subtitle={briefDate(brief, today)}>
      {content ? (
        <div className="brief-body">
          {brief.for_day !== today && <p className="brief-old">This is the last brief – today’s hasn’t arrived (yet).</p>}
          {content.note && <p className="brief-note">{content.note}</p>}
          {content.tickers?.length > 0 && (
            <p className="brief-tickers">
              {content.tickers.map((ticker) => (
                <span key={ticker} className="brief-ticker">
                  {ticker}
                </span>
              ))}
              <span className="brief-tickers-label">covered</span>
            </p>
          )}
          {content.summary && <p className="brief-summary">{content.summary}</p>}
          {content.intro && <p className="brief-intro">{content.intro}</p>}
          {content.quiet && content.sections.length === 0 && <p className="empty-note">A quiet day – nothing worth flagging.</p>}
          {kind === 'world' ? <NumberedList sections={content.sections} /> : <Sections sections={content.sections} />}
        </div>
      ) : (
        <p className="empty-note">No brief yet. The first one arrives at 08:00 ({meta.schedule.toLowerCase()}).</p>
      )}
      <p className="brief-footer">
        {meta.footer} Next brief: {meta.schedule}.
      </p>
    </Modal>
  )
}

// IBKR and Canada jobs: headings, each with link cards (jobs: "why it matters").
function Sections({ sections }) {
  return sections.map((section) => (
    <section key={section.heading} className="brief-section">
      <h3 className="brief-heading">{section.heading}</h3>
      <ul className="brief-items">
        {section.items.map((item) => (
          <li key={item.url + item.headline}>
            <a className="brief-card" href={item.url} target="_blank" rel="noopener noreferrer">
              <span className="brief-headline">{item.headline}</span>
              {item.why && <span className="brief-why">Why it matters: {item.why}</span>}
              <span className="brief-source">
                {item.source} <span aria-hidden="true">↗</span>
                <span className="visually-hidden"> (opens in a new tab)</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  ))
}

// World news: one simple numbered list of headlines (owner: keep it simple).
function NumberedList({ sections }) {
  const items = sections.flatMap((section) => section.items)
  return (
    <ol className="brief-numbered">
      {items.map((item, index) => (
        <li key={item.url + item.headline}>
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <span className="brief-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="brief-headline">{item.headline}</span>
            <span className="brief-source">
              {item.source} <span aria-hidden="true">↗</span>
              <span className="visually-hidden"> (opens in a new tab)</span>
            </span>
          </a>
        </li>
      ))}
    </ol>
  )
}

export default BriefWindow
