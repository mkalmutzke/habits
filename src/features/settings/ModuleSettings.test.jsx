// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ModuleSettings from './ModuleSettings.jsx'

// v3.8 (owner): Settings → Modules
describe('ModuleSettings', () => {
  it('shows today’s choices and saves new ones', async () => {
    const update = vi.fn()
    render(<ModuleSettings settings={{}} update={update} />)
    await userEvent.click(screen.getByRole('button', { name: /^Modules/ }))
    expect(screen.getByRole('button', { name: 'IBKR portfolio' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Icon' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Section' }))
    expect(update).toHaveBeenLastCalledWith({ garmin_display: 'section' })
    await userEvent.click(screen.getByRole('button', { name: 'IBKR portfolio' }))
    expect(update).toHaveBeenLastCalledWith({ ibkr_display: 'off' })
    expect(screen.getByRole('button', { name: 'Server health' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Server health' }))
    expect(update).toHaveBeenLastCalledWith({ server_display: 'icon' })
  })

  it('counts what is shown', () => {
    render(<ModuleSettings settings={{ ibkr_display: 'off', garmin_display: 'off' }} update={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^Modules/ })).toHaveTextContent('0 of 3 shown')
  })
})
