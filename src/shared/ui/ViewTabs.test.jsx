// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ViewTabs from './ViewTabs.jsx'

const OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'lists', label: 'Lists' },
]

describe('ViewTabs', () => {
  it('marks the current option as selected', () => {
    render(<ViewTabs options={OPTIONS} value="week" onChange={() => {}} label="View" />)
    expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Today' })).toHaveAttribute('aria-selected', 'false')
  })

  it('reports a click', async () => {
    const onChange = vi.fn()
    render(<ViewTabs options={OPTIONS} value="today" onChange={onChange} label="View" />)
    await userEvent.click(screen.getByRole('tab', { name: 'Lists' }))
    expect(onChange).toHaveBeenCalledWith('lists')
  })

  it('moves with the arrow keys and wraps around', async () => {
    const onChange = vi.fn()
    render(<ViewTabs options={OPTIONS} value="today" onChange={onChange} label="View" />)
    screen.getByRole('tab', { name: 'Today' }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenCalledWith('lists')
  })
})
