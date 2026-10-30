// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import HabitWeekGrid from './HabitWeekGrid.jsx'

const TODAY = '2026-10-08' // Thursday
const habits = [
  { id: 'dog', name: 'Walk Bello', subtitle: 'Morning round', emoji: '🐕', completions: ['2026-10-02', '2026-10-06', '2026-10-07'] },
  { id: 'gym', name: 'Gym', subtitle: '', emoji: '🏃', completions: ['2026-10-05'] },
]

function renderGrid(props = {}) {
  const handlers = { onToggle: vi.fn(), onEdit: vi.fn() }
  render(<HabitWeekGrid habits={habits} today={TODAY} {...handlers} {...props} />)
  return handlers
}

const dayButtons = (name) => screen.getAllByRole('button', { name: new RegExp(`^${name}, `) })

describe('HabitWeekGrid (design v3 §2.2, v3.1)', () => {
  it('shows the last 4 days, today last (TS-H1, v3.1)', () => {
    renderGrid()
    const dog = dayButtons('Walk Bello')
    expect(dog).toHaveLength(4)
    expect(dog[0]).toHaveAccessibleName(/Mon 5 Oct/)
    expect(dog[3]).toHaveAccessibleName(/Thu 8 Oct/)
  })

  it('shows the streak – days in a row, not limited to a week – with a flame (v3.1.1)', () => {
    const streak12 = { id: 'run', name: 'Run', subtitle: '', emoji: '🏃', completions: ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'] }
    render(<HabitWeekGrid habits={[streak12]} today={TODAY} onToggle={vi.fn()} />)
    expect(screen.getByLabelText('12 days in a row')).toHaveTextContent('12 🔥')
    expect(screen.queryByText(/\/7/)).not.toBeInTheDocument()
  })

  it('shows title and subtitle on two lines', () => {
    renderGrid()
    expect(screen.getByText('Walk Bello')).toBeInTheDocument()
    expect(screen.getByText('Morning round')).toHaveClass('wg-subtitle')
    expect(screen.getByRole('button', { name: 'Walk Bello – Morning round – edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gym – edit' })).toBeInTheDocument()
  })

  it('marks ticked days as pressed and ticks any shown day (TS-H2, TS-H3)', async () => {
    const { onToggle } = renderGrid()
    expect(dayButtons('Walk Bello')[2]).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(dayButtons('Gym')[1])
    await userEvent.click(dayButtons('Gym')[3])
    expect(onToggle.mock.calls.map(([habit, day]) => `${habit.id} ${day}`)).toEqual(['gym 2026-10-06', 'gym 2026-10-08'])
  })

  it('shows the flame only from 2 days in a row (TS-H4)', () => {
    renderGrid()
    expect(screen.getByLabelText('2 days in a row')).toHaveTextContent('2 🔥')
    expect(screen.getAllByText(/🔥/)).toHaveLength(1)
  })

  it('opens the habit for editing from its text', async () => {
    const { onEdit } = renderGrid()
    await userEvent.click(screen.getByRole('button', { name: 'Gym – edit' }))
    expect(onEdit).toHaveBeenCalledWith(habits[1])
  })

  it('can’t tick while offline', () => {
    renderGrid({ disabled: true })
    expect(dayButtons('Gym')[3]).toBeDisabled()
  })
})

describe('HabitWeekGrid – reorder (design v3.3 §3.2, TS-O)', () => {
  const three = [...habits, { id: 'pill', name: 'Vitamin D', subtitle: '', emoji: '💊', completions: [] }]
  const grip = (name) => screen.getByRole('button', { name: `Move ${name}` })
  const status = () => screen.getByRole('status')

  function renderSortable(props = {}) {
    const handlers = { onToggle: vi.fn(), onEdit: vi.fn(), onMove: vi.fn() }
    render(<HabitWeekGrid habits={three} today={TODAY} {...handlers} {...props} />)
    return handlers
  }

  it('every row has a grip (TS-O3)', () => {
    renderSortable()
    expect(screen.getAllByRole('button', { name: /^Move / })).toHaveLength(3)
  })

  it('no grips without onMove', () => {
    renderGrid()
    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull()
  })

  it('grips are switched off offline (TS-O3)', () => {
    renderSortable({ disabled: true })
    expect(grip('Gym')).toBeDisabled()
  })

  it('keyboard: Space picks up, ↓ ↓ moves, Space drops – one move, spoken positions (TS-O4)', async () => {
    const user = userEvent.setup()
    const { onMove } = renderSortable()
    grip('Walk Bello').focus()
    await user.keyboard(' ')
    expect(grip('Walk Bello')).toHaveAttribute('aria-pressed', 'true')
    expect(status()).toHaveTextContent('Walk Bello picked up, position 1 of 3')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(status()).toHaveTextContent('Walk Bello, position 3 of 3')
    await user.keyboard('{ArrowDown}') // stays at the bottom
    await user.keyboard(' ')
    expect(onMove).toHaveBeenCalledOnce()
    expect(onMove).toHaveBeenCalledWith(0, 2)
    expect(status()).toHaveTextContent('Walk Bello dropped at position 3 of 3')
  })

  it('keyboard: Esc puts the habit back and saves nothing (TS-O5)', async () => {
    const user = userEvent.setup()
    const { onMove } = renderSortable()
    grip('Vitamin D').focus()
    await user.keyboard(' {ArrowUp}{Escape}')
    expect(onMove).not.toHaveBeenCalled()
    expect(grip('Vitamin D')).toHaveAttribute('aria-pressed', 'false')
    expect(status()).toHaveTextContent('Move cancelled. Vitamin D stays at position 3 of 3.')
  })

  it('a tap on the grip neither ticks nor opens the habit (TS-O9)', async () => {
    const user = userEvent.setup()
    const { onToggle, onEdit, onMove } = renderSortable()
    await user.click(grip('Gym'))
    expect(onToggle).not.toHaveBeenCalled()
    expect(onEdit).not.toHaveBeenCalled()
    expect(onMove).not.toHaveBeenCalled()
  })
})
