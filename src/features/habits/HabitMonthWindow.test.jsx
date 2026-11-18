// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import HabitMonthWindow from './HabitMonthWindow.jsx'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false
  }
})

const TODAY = '2026-11-18'
const habits = [
  { id: 'walk', name: 'Walk', emoji: '🐕', groupId: 'dog', createdAt: '2026-09-01T08:00:00', completions: ['2026-11-16', '2026-11-17', '2026-10-31'], breaks: [] },
  { id: 'gym', name: 'Gym', emoji: '🏃', groupId: null, createdAt: '2026-09-01T08:00:00', completions: ['2026-11-16', '2026-10-31'], breaks: ['2026-11-17'] },
]
const groups = [{ id: 'dog', name: 'Dog', position: 1, created_at: '2026-09-01T08:00:00Z' }]

// v3.8 (owner): this month and last month, complete days and breaks
describe('HabitMonthWindow', () => {
  it('shows this and last month and how each day went', () => {
    render(<HabitMonthWindow habits={habits} today={TODAY} onClose={() => {}} />)
    const november = screen.getByRole('region', { name: 'November' })
    expect(within(november).getByRole('heading')).toHaveTextContent('2 complete · 1 with breaks')
    expect(within(november).getByRole('button', { name: 'Mon 16 Nov: all done, 2 of 2 done' })).toHaveClass('full')
    expect(within(november).getByRole('button', { name: 'Tue 17 Nov: complete with breaks, 1 of 2 done, 1 on a break' })).toHaveClass('breaks')
    expect(within(november).getByRole('button', { name: 'Thu 19 Nov: still to come' })).toBeDisabled()
    expect(screen.getByRole('region', { name: 'October' })).toHaveTextContent('1 complete')
  })

  it('tapping a day lists its habits', async () => {
    render(<HabitMonthWindow habits={habits} today={TODAY} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /^Tue 17 Nov/ }))
    expect(screen.getByRole('heading', { name: 'Tue 17 Nov' })).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem').filter((item) => item.closest('.hm-detail-list'))
    expect(rows.map((row) => row.textContent)).toEqual(['🐕 WalkDone', '🏃 GymBreak'])
  })

  it('with groups, a filter shows one group', async () => {
    render(<HabitMonthWindow habits={habits} groups={groups} defaultGroupName="Other" today={TODAY} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Dog' }))
    expect(screen.getByRole('button', { name: /^Tue 17 Nov/ })).toHaveAccessibleName('Tue 17 Nov: all done, 1 of 1 done')
    expect(screen.getByText('1 habit · tap a day for details')).toBeInTheDocument()
  })
})
