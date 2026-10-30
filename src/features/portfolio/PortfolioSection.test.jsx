// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetSectionMemory } from '../../shared/hooks/useSectionOpen.js'
import { currentPortfolio } from './portfolio.js'
import PortfolioSection from './PortfolioSection.jsx'

const TODAY = '2026-10-28' // a Wednesday; the newest report is Tuesday's

// Sample figures for the tests – not a real portfolio.
const snapshot = {
  id: 's',
  as_of: '2026-10-27',
  base_currency: 'CHF',
  nav: 45870,
  cash: 1180,
  day_change: 382,
  day_twr: 0.84,
  twr: 9.6,
  twr_from: '2026-01-01',
  twr_to: '2026-10-27',
}
const position = (symbol, value, values = {}) => ({
  id: symbol,
  snapshot_id: 's',
  symbol,
  description: `${symbol} Holding`,
  currency: 'USD',
  quantity: 10,
  mark_price: 102,
  prev_close_price: 100,
  value_base: value,
  day_change_base: 20,
  cost_basis_base: value / 2,
  unrealized_base: value / 2,
  ...values,
})
const positions = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF'].map((symbol, index) => position(symbol, 9000 - index * 1000))
const portfolio = (snapshots = [snapshot], rows = positions) => ({ current: currentPortfolio(snapshots, rows), loading: false })

const header = () => screen.getByRole('button', { name: /^IBKR/ })

describe('PortfolioSection (design v3.4 §2)', () => {
  beforeEach(resetSectionMemory)

  it('starts folded; the header shows only the day’s move, never the value (D2)', () => {
    render(<PortfolioSection portfolio={portfolio()} today={TODAY} />)
    expect(header()).toHaveAttribute('aria-expanded', 'false')
    expect(header()).toHaveTextContent('+0.84% yesterday')
    expect(header()).not.toHaveTextContent('45')
  })

  it('opened: amounts hidden, percentages and TWR YTD shown (D3, D4)', async () => {
    const user = userEvent.setup()
    render(<PortfolioSection portfolio={portfolio()} today={TODAY} />)
    await user.click(header())
    expect(screen.queryByText('CHF 45’870')).toBeNull()
    expect(screen.getAllByText('CHF •••').length).toBeGreaterThan(0)
    expect(screen.getByText('+CHF •••')).toBeVisible()
    expect(screen.getByText('TWR YTD')).toBeVisible()
    expect(screen.getByText('+9.6%')).toBeVisible()
    expect(screen.getByText('As of Tue 27 Oct · market close')).toBeVisible()
  })

  it('the eye shows and hides the amounts', async () => {
    const user = userEvent.setup()
    render(<PortfolioSection portfolio={portfolio()} today={TODAY} />)
    await user.click(header())
    await user.click(screen.getByRole('button', { name: 'Show amounts' }))
    expect(screen.getByText('CHF 45’870')).toBeVisible()
    expect(screen.getByText('+CHF 382')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Hide amounts' }))
    expect(screen.queryByText('CHF 45’870')).toBeNull()
  })

  it('a new app start hides the amounts again', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<PortfolioSection portfolio={portfolio()} today={TODAY} />)
    await user.click(screen.getByRole('button', { name: 'Show amounts' }))
    unmount()
    resetSectionMemory() // what a new app start does
    render(<PortfolioSection portfolio={portfolio()} today={TODAY} />)
    expect(screen.getByRole('button', { name: 'Show amounts' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('top 5 holdings largest first, the rest behind "+ n more"', async () => {
    const user = userEvent.setup()
    render(<PortfolioSection portfolio={portfolio()} today={TODAY} />)
    await user.click(header())
    const symbols = () => screen.getAllByRole('listitem').map((item) => item.querySelector('.portfolio-symbol').firstChild.textContent)
    expect(symbols()).toEqual(['AAA', 'BBB', 'CCC', 'DDD', 'EEE'])
    await user.click(screen.getByRole('button', { name: '+ 2 more' }))
    expect(symbols()).toEqual(['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'Cash'])
    // today (102 vs 100) · total (gain / cost) for every holding; cash has none
    const changes = [...document.querySelectorAll('.portfolio-changes')].map((line) => line.textContent)
    expect(changes).toEqual(Array(6).fill('+2.0% · +100.0%'))
  })

  it('an old report says the update did not come', async () => {
    const user = userEvent.setup()
    render(<PortfolioSection portfolio={portfolio([{ ...snapshot, as_of: '2026-10-22' }])} today={TODAY} />)
    expect(header()).toHaveTextContent('+0.84% Thu')
    await user.click(header())
    expect(screen.getByText('Couldn’t update since Thu 22 Oct')).toBeVisible()
  })

  it('before the first report: says so, no eye button', async () => {
    const user = userEvent.setup()
    render(<PortfolioSection portfolio={portfolio([], [])} today={TODAY} />)
    expect(header()).toHaveTextContent('not set up yet')
    expect(screen.queryByRole('button', { name: 'Show amounts' })).toBeNull()
    await user.click(header())
    expect(screen.getByText(/No report from IBKR yet/)).toBeVisible()
  })
})
