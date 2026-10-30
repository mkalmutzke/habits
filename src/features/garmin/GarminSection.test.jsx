// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetSectionMemory } from '../../shared/hooks/useSectionOpen.js'
import GarminSection from './GarminSection.jsx'

const TODAY = '2026-10-28' // a Wednesday; the 7 days are Thu 22 – Wed 28 Oct

// Sample figures for the tests – not real Garmin data.
const fetched = new Date(Date.now() - 60 * 60 * 1000).toISOString()
const day = (key, steps, resting_hr) => ({ id: key, day: key, steps, resting_hr, fetched_at: fetched })
const days = [
  day('2026-10-02', 20000, 60),
  day('2026-10-22', 9412, 52),
  day('2026-10-23', 11830, 51),
  day('2026-10-24', 6204, 53),
  day('2026-10-25', 14950, 50),
  day('2026-10-26', 8120, 52),
  day('2026-10-27', 7365, 54),
  day('2026-10-28', 4180, 51),
]
const activity = (id, key, type, moving_s, duration_s = moving_s) => ({ id, day: key, activity_type: type, moving_s, duration_s })
const activities = [
  activity('a', '2026-10-22', 'running', 2700),
  activity('b', '2026-10-24', 'trail_running', 3000),
  activity('c', '2026-10-25', 'strength_training', null, 1800),
  activity('d', '2026-10-02', 'road_biking', 7200),
]
const garmin = (values = {}) => ({ days, activities, loading: false, ...values })

const header = () => screen.getByRole('button', { name: /^Garmin/ })

describe('GarminSection (design v3.5 §2)', () => {
  beforeEach(resetSectionMemory)

  it('starts folded; the header shows the 7-day averages (G2, G3)', () => {
    render(<GarminSection garmin={garmin()} today={TODAY} />)
    expect(header()).toHaveAttribute('aria-expanded', 'false')
    expect(header()).toHaveTextContent('Ø 8’866 steps · Ø 52 bpm')
  })

  it('opened: steps and resting heart rate per day with the average, today last (G6)', async () => {
    render(<GarminSection garmin={garmin()} today={TODAY} />)
    await userEvent.click(header())
    expect(screen.getByText('8’866')).toBeInTheDocument()
    const rows = screen.getAllByRole('list')
    expect(rows[0]).toHaveTextContent('9’412Thu11’830Fri6’204Sat14’950Sun8’120Mon7’365Tue4’180today')
    expect(rows[1]).toHaveTextContent('52Thu51Fri53Sat50Sun52Mon54Tue51today')
  })

  it('opened: activities by type with count and moving time, no km, plus a total (G4, G5)', async () => {
    render(<GarminSection garmin={garmin()} today={TODAY} />)
    await userEvent.click(header())
    const table = screen.getByRole('table')
    expect(within(table).getByRole('row', { name: /Running/ })).toHaveTextContent('Running2×1:35 h')
    expect(within(table).getByRole('row', { name: /Strength/ })).toHaveTextContent('Strength1×0:30 h')
    expect(within(table).getByRole('row', { name: /Total/ })).toHaveTextContent('Total3×2:05 h')
    expect(table).not.toHaveTextContent('km')
  })

  it('the toggle shows the calendar month with steps per day and only the average heart rate (G10, G11)', async () => {
    render(<GarminSection garmin={garmin()} today={TODAY} />)
    await userEvent.click(header())
    await userEvent.click(screen.getByRole('button', { name: 'Month' }))
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('October · 1 – 28 Oct')).toBeInTheDocument()
    const cells = within(screen.getByRole('list', { name: 'Steps per day this month' })).getAllByRole('listitem')
    expect(cells).toHaveLength(28)
    expect(cells[1]).toHaveTextContent('20.0')
    expect(screen.getByText('2 Oct: 20’000 steps')).toBeInTheDocument()
    // the month's heart rate: only the average, no row of days
    expect(screen.getAllByRole('list')).toHaveLength(1)
    expect(within(screen.getByRole('table')).getByRole('row', { name: /Total/ })).toHaveTextContent('Total4×4:05 h')
    // the header keeps the 7-day averages
    expect(header()).toHaveTextContent('Ø 8’866 steps · Ø 52 bpm')
  })

  it('says when there is no data yet', async () => {
    render(<GarminSection garmin={garmin({ days: [], activities: [] })} today={TODAY} />)
    expect(header()).toHaveTextContent('not set up yet')
    await userEvent.click(header())
    expect(screen.getByText(/No data from Garmin yet/)).toBeInTheDocument()
  })

  it('turns the footer amber when nothing new arrived for more than 2 days', async () => {
    const old = days.map((row) => ({ ...row, fetched_at: '2026-10-20T07:00:00Z' }))
    render(<GarminSection garmin={garmin({ days: old })} today={TODAY} />)
    await userEvent.click(header())
    expect(screen.getByText(/No new data from Garmin since/)).toHaveClass('stale')
  })
})
