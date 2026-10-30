import { useState } from 'react'
import { useSectionOpen } from '../../shared/hooks/useSectionOpen.js'
import CollapsibleSection from '../../shared/ui/CollapsibleSection.jsx'
import Icon from '../../shared/ui/Icon.jsx'
import { formatShortDate, formatWeekday } from '../../shared/utils/date.js'
import { dayLabel, formatMoney, formatPercent, isStale, tone, TOP_HOLDINGS, twrLabel } from './portfolio.js'
import './portfolio.css'

// "IBKR" on What's up? (v3.4): a foldable
// card like Habits, folded at every app start. Its header shows only the
// portfolio's move of the newest trading day – never the value (owner D2).
// Amounts are hidden at every app start on every device; the eye shows them
// until the app is closed (owner D4). Percentages always show.
function PortfolioSection({ portfolio, today }) {
  const section = useSectionOpen('ibkr')
  const [showAmounts, setShowAmounts] = useSectionOpen('ibkr-amounts')
  const { current, loading } = portfolio
  const snapshot = current?.snapshot
  const day = snapshot ? dayLabel(snapshot.as_of, today) : null

  return (
    <CollapsibleSection
      state={section}
      className="portfolio-section"
      title="IBKR"
      summary={
        snapshot ? (
          <span className={`tone-${tone(snapshot.day_twr)}`}>
            {formatPercent(snapshot.day_twr)} {day}
          </span>
        ) : loading ? null : (
          'not set up yet'
        )
      }
      actions={
        snapshot && (
          <button
            type="button"
            className="section-icon-button"
            aria-label={showAmounts ? 'Hide amounts' : 'Show amounts'}
            aria-pressed={showAmounts}
            onClick={() => setShowAmounts(!showAmounts)}
          >
            <Icon name={showAmounts ? 'eye' : 'eyeOff'} />
          </button>
        )
      }
    >
      {snapshot ? (
        <PortfolioBody current={current} day={day} hidden={!showAmounts} today={today} />
      ) : (
        <p className="empty-note">{loading ? 'Loading…' : 'No report from IBKR yet. It arrives the morning after a trading day once IBKR is connected.'}</p>
      )}
    </CollapsibleSection>
  )
}

function PortfolioBody({ current, day, hidden, today }) {
  const [showAll, setShowAll] = useState(false)
  const { snapshot, holdings } = current
  const currency = snapshot.base_currency
  const money = (value, signed = false) => formatMoney(value, currency, { hidden, signed })
  const shown = showAll ? holdings : holdings.slice(0, TOP_HOLDINGS)
  const rest = holdings.length - TOP_HOLDINGS
  const date = `${formatWeekday(snapshot.as_of)} ${formatShortDate(snapshot.as_of)}`
  const stale = isStale(snapshot.as_of, today)

  return (
    <>
      <dl className="portfolio-totals">
        <div>
          <dt>Value</dt>
          <dd className="portfolio-big">{money(snapshot.nav)}</dd>
          <dd className="portfolio-small">{holdings.filter((row) => !row.cash).length} holdings</dd>
        </div>
        <div>
          <dt>{day}</dt>
          <dd className={`portfolio-big tone-${tone(snapshot.day_twr)}`}>{formatPercent(snapshot.day_twr)}</dd>
          <dd className={`portfolio-small tone-${tone(snapshot.day_change)}`}>{money(snapshot.day_change, true)}</dd>
        </div>
        <div>
          <dt>{twrLabel(snapshot.twr_from)}</dt>
          <dd className={`portfolio-big tone-${tone(snapshot.twr)}`}>{formatPercent(snapshot.twr, 1)}</dd>
          {snapshot.twr_from && <dd className="portfolio-small">since {formatShortDate(snapshot.twr_from)}</dd>}
        </div>
      </dl>

      <ul className="portfolio-holdings">
        {shown.map((holding) => (
          <li key={holding.id} className="portfolio-holding">
            <span className="portfolio-name">
              <span className="portfolio-symbol">
                {holding.symbol}
                {holding.currency && holding.currency !== currency && <span className="portfolio-currency">{holding.currency}</span>}
              </span>
              <span className="portfolio-description">{holding.name}</span>
            </span>
            <span className="portfolio-figures">
              <span>{money(holding.value)}</span>
              {!holding.cash && (
                <span className="portfolio-changes">
                  <span className={`tone-${tone(holding.dayPct)}`}>{formatPercent(holding.dayPct, 1)}</span>
                  {' · '}
                  <span className={`tone-${tone(holding.totalPct)}`}>{formatPercent(holding.totalPct, 1)}</span>
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <button type="button" className="portfolio-more" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `+ ${rest} more`}
        </button>
      )}

      <p className={stale ? 'portfolio-stamp stale' : 'portfolio-stamp'}>
        <span>{stale ? `Couldn’t update since ${date}` : `As of ${date} · market close`}</span>
        <span>day · total</span>
      </p>
    </>
  )
}

export default PortfolioSection
