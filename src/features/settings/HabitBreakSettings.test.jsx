// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import HabitBreakSettings from './HabitBreakSettings.jsx'

// v3.8 (owner): Settings → Habit breaks – no limit to start with, one can be set.
describe('HabitBreakSettings', () => {
  it('starts with no limit and saves a chosen one, or “No limit” again', async () => {
    const update = vi.fn()
    const { rerender } = render(<HabitBreakSettings settings={{ habit_break_limit: null }} update={update} />)
    expect(screen.getByRole('button', { name: /Habit breaks/ })).toHaveTextContent('no limit')
    await userEvent.click(screen.getByRole('button', { name: /Habit breaks/ }))
    const limit = screen.getByLabelText(/Breaks per habit and month/)
    expect(limit).toHaveValue('')
    await userEvent.selectOptions(limit, '3')
    expect(update).toHaveBeenLastCalledWith({ habit_break_limit: 3 })

    rerender(<HabitBreakSettings settings={{ habit_break_limit: 3 }} update={update} />)
    expect(screen.getByRole('button', { name: /Habit breaks/ })).toHaveTextContent('3 per month')
    await userEvent.selectOptions(screen.getByLabelText(/Breaks per habit and month/), 'No limit')
    expect(update).toHaveBeenLastCalledWith({ habit_break_limit: null })
  })
})
