// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TaskRow from './TaskRow.jsx'

const TODAY = '2026-10-10'
const task = {
  id: 't1',
  title: 'Call the dentist',
  list_id: 'home',
  due_date: '2026-10-09',
  important: false,
  repeat_rule: { freq: 'weekly', interval: 1 },
  completed_at: null,
}

function renderRow(props = {}) {
  const handlers = { onToggle: vi.fn(), onStar: vi.fn() }
  render(
    <ul>
      <TaskRow task={task} today={TODAY} listName="Home" steps={[{ done: true }, { done: false }]} {...handlers} {...props} />
    </ul>,
  )
  return handlers
}

describe('TaskRow', () => {
  it('shows list, overdue date, repeat and steps – no My Day any more (v3)', () => {
    renderRow()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Yesterday')).toHaveClass('tone-overdue')
    expect(screen.getByText('↻ Weekly')).toBeInTheDocument()
    expect(screen.queryByText('☀ My Day')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Call the dentist/ })).toHaveAttribute('href', '#/task/t1')
  })

  it('reports ticking and starring', async () => {
    const { onToggle, onStar } = renderRow()
    await userEvent.click(screen.getByRole('button', { name: 'Mark done: Call the dentist' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mark important: Call the dentist' }))
    expect(onToggle).toHaveBeenCalledWith(task)
    expect(onStar).toHaveBeenCalledWith(task)
  })

  it('can be switched off (offline)', () => {
    renderRow({ disabled: true })
    expect(screen.getByRole('button', { name: 'Mark done: Call the dentist' })).toBeDisabled()
  })
})
