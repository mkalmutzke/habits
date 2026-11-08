// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSectionMemory } from '../../shared/hooks/useSectionOpen.js'
import { ToastContext } from '../../shared/ui/toast.js'
import GarminWindow from './GarminWindow.jsx'

// jsdom has <dialog> but no showModal/close
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false
  }
})

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
const activity = (id, key, type, moving_s, duration_s = moving_s, distance_m = null, elevation_gain_m = null) => ({
  id,
  day: key,
  activity_type: type,
  moving_s,
  duration_s,
  distance_m,
  elevation_gain_m,
})
const activities = [
  activity('a', '2026-10-22', 'running', 2700, 2700, 8000, 120),
  activity('b', '2026-10-24', 'trail_running', 3000, 3000, 9500, 640.4),
  activity('c', '2026-10-25', 'strength_training', null, 1800),
  activity('d', '2026-10-02', 'road_biking', 7200, 7200, 50000, 1150),
]
const garmin = (values = {}) => ({ days, activities, loading: false, refresh: vi.fn(), refreshing: false, ...values })

function renderWindow(model = garmin(), toast = { show: vi.fn(), dismiss: () => {} }) {
  render(
    <ToastContext.Provider value={toast}>
      <GarminWindow garmin={model} today={TODAY} onClose={() => {}} />
    </ToastContext.Provider>,
  )
  return toast
}

describe('GarminWindow (v3.5 §2, v3.6 window)', () => {
  beforeEach(resetSectionMemory)

  it('the line under the title shows the 7-day averages (G3)', () => {
    renderWindow()
    expect(screen.getByRole('dialog', { name: 'Garmin' })).toBeInTheDocument()
    expect(screen.getByText('7 days: Ø 8’866 steps · Ø 52 bpm')).toBeInTheDocument()
  })

  it('steps as a bar chart and resting heart rate per day, today last (G6, v3.6)', () => {
    renderWindow()
    expect(screen.getByText('8’866')).toBeInTheDocument()
    const chart = screen.getByRole('list', { name: 'Steps per day, last 7 days' })
    expect(within(chart).getAllByRole('listitem')).toHaveLength(7)
    expect(chart).toHaveTextContent('9.4Thu: 9’412 steps')
    expect(chart).toHaveTextContent('4.2today: 4’180 steps')
    const rows = screen.getAllByRole('list')
    expect(rows[1]).toHaveTextContent('52Thu51Fri53Sat50Sun52Mon54Tue51today')
  })

  it('v3.7: elevation climbed in the 7 days, in total and per day', () => {
    renderWindow()
    expect(screen.getByText('760')).toBeInTheDocument()
    const rows = screen.getAllByRole('list')
    expect(rows[2]).toHaveTextContent('120Thu–Fri640Sat0Sun–Mon–Tue–today')
  })

  it('Refresh asks garmin-sync and shows the answer (v3.6)', async () => {
    const model = garmin({ refresh: vi.fn().mockResolvedValue({ ok: true, message: 'Garmin data updated.' }) })
    const toast = renderWindow(model)
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(model.refresh).toHaveBeenCalledOnce()
    expect(toast.show).toHaveBeenCalledWith('Garmin data updated.', {})
  })

  it('Refresh is disabled while it runs', () => {
    renderWindow(garmin({ refreshing: true }))
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled()
  })

  it('activities by type with count, distance (v3.6), moving time and elevation (v3.7), plus a total (G4, G5)', () => {
    renderWindow()
    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Elevation' })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /Running/ })).toHaveTextContent('Running2×17.5 km1:35 h760 m')
    expect(within(table).getByRole('row', { name: /Strength/ })).toHaveTextContent('Strength1×–0:30 h–')
    expect(within(table).getByRole('row', { name: /Total/ })).toHaveTextContent('Total3×17.5 km2:05 h760 m')
  })

  it('the toggle shows the calendar month with steps per day and only the average heart rate (G10, G11)', async () => {
    renderWindow()
    await userEvent.click(screen.getByRole('button', { name: 'Month' }))
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('October · 1 – 28 Oct')).toBeInTheDocument()
    const cells = within(screen.getByRole('list', { name: 'Steps per day this month' })).getAllByRole('listitem')
    expect(cells).toHaveLength(28)
    expect(cells[1]).toHaveTextContent('20.0')
    expect(screen.getByText('2 Oct: 20’000 steps')).toBeInTheDocument()
    // v3.7: the month's elevation per day, in the same calendar cells
    const climbs = within(screen.getByRole('list', { name: 'Elevation per day this month' })).getAllByRole('listitem')
    expect(climbs).toHaveLength(28)
    expect(screen.getByText('2 Oct: 1’150 m climbed')).toBeInTheDocument()
    expect(screen.getByText('1 Oct: no activity')).toBeInTheDocument()
    expect(screen.getByText('1’910')).toBeInTheDocument()
    // the month's heart rate: only the average, no row of days
    expect(screen.getAllByRole('list')).toHaveLength(2)
    expect(within(screen.getByRole('table')).getByRole('row', { name: /Total/ })).toHaveTextContent('Total4×67.5 km4:05 h1’910 m')
    // the line under the title keeps the 7-day averages
    expect(screen.getByText('7 days: Ø 8’866 steps · Ø 52 bpm')).toBeInTheDocument()
  })

  it('says when there is no data yet', () => {
    renderWindow(garmin({ days: [], activities: [] }))
    expect(screen.getByText(/No data from Garmin yet/)).toBeInTheDocument()
  })

  it('turns the footer amber when nothing new arrived for more than 2 days', () => {
    const old = days.map((row) => ({ ...row, fetched_at: '2026-10-20T07:00:00Z' }))
    renderWindow(garmin({ days: old }))
    expect(screen.getByText(/No new data from Garmin since/)).toHaveClass('stale')
  })
})
