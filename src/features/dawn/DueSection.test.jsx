// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSectionMemory } from '../../shared/hooks/useSectionOpen.js'
import DueSection from './DueSection.jsx'

const TODAY = '2026-10-21' // a Wednesday
const task = (id, title, due_date, values = {}) => ({
  id,
  title,
  due_date,
  list_id: 'home',
  important: false,
  completed_at: null,
  deleted_at: null,
  repeat_rule: null,
  position: 1,
  created_at: '2026-10-01T10:00:00Z',
  ...values,
})

const todos = (tasks) => ({
  tasks,
  lists: [{ id: 'home', name: 'Home', color: 'amber', show_in_all: false }],
  steps: [],
  loading: false,
  toggleTask: vi.fn(),
  updateTask: vi.fn(),
})

const header = () => screen.getByRole('button', { name: /^Due & overdue/ })

describe('DueSection (design v3.3 §3.4)', () => {
  beforeEach(resetSectionMemory)

  const tasks = [
    task('a', 'Call the plumber', '2026-10-18'),
    task('b', 'Renew passport', '2026-10-19'),
    task('c', 'Pay electricity bill', TODAY),
    task('d', 'Book dentist', '2026-10-23'),
    task('e', 'Birthday gift', '2026-10-25'),
    task('f', 'Next month', '2026-11-20'),
  ]

  it('starts folded; the header counts overdue and this week (TS-D6, TS-F11)', () => {
    render(<DueSection todos={todos(tasks)} today={TODAY} />)
    expect(header()).toHaveAttribute('aria-expanded', 'false')
    expect(header()).toHaveTextContent('2 overdue · 3 this week')
  })

  it('open: Overdue first, then one group per day, list names shown (TS-D5)', async () => {
    const user = userEvent.setup()
    render(<DueSection todos={todos(tasks)} today={TODAY} />)
    await user.click(header())
    const labels = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(labels).toEqual(['Overdue', 'Today · Wed 21 Oct', 'Fri 23 Oct', 'Sun 25 Oct'])
    const overdue = screen.getByRole('heading', { name: 'Overdue' }).parentElement
    expect(within(overdue).getAllByRole('link').map((link) => link.textContent)).toEqual([
      expect.stringContaining('Call the plumber'),
      expect.stringContaining('Renew passport'),
    ])
    // a list that is "not in All" still shows here (owner Q3)
    expect(within(overdue).getAllByText(/Home/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Next month')).toBeNull()
  })

  it('ticking a task completes it (TS-D7)', async () => {
    const user = userEvent.setup()
    const data = todos(tasks)
    render(<DueSection todos={data} today={TODAY} />)
    await user.click(header())
    await user.click(screen.getByRole('button', { name: 'Mark done: Pay electricity bill' }))
    expect(data.toggleTask).toHaveBeenCalled()
  })

  it('nothing due: says so in the header and the card', async () => {
    const user = userEvent.setup()
    render(<DueSection todos={todos([task('x', 'Later', '2026-12-01')])} today={TODAY} />)
    expect(header()).toHaveTextContent('nothing due')
    await user.click(header())
    expect(screen.getByText('Nothing overdue or due this week.')).toBeVisible()
  })

  it('a new day turns today’s task into an overdue one (TS-D9)', async () => {
    const user = userEvent.setup()
    const data = todos([task('c', 'Pay electricity bill', TODAY)])
    const { rerender } = render(<DueSection todos={data} today={TODAY} />)
    expect(header()).toHaveTextContent('1 this week')
    rerender(<DueSection todos={data} today="2026-10-22" />)
    expect(header()).toHaveTextContent('1 overdue · 0 this week')
    await user.click(header())
    expect(screen.getByRole('heading', { name: 'Overdue' })).toBeVisible()
  })
})
