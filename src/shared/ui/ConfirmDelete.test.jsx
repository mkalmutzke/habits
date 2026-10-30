// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDelete from './ConfirmDelete.jsx'

describe('ConfirmDelete', () => {
  it('asks first; Keep goes back, Delete confirms', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDelete label="Delete list" question="Delete “Home”?" onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Delete list' }))
    expect(screen.getByText('Delete “Home”?')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.getByRole('button', { name: 'Delete list' })).toBeVisible()
    expect(onConfirm).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete list' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('own labels; a disabled first button can’t be tapped', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ConfirmDelete label="Delete my account" keepLabel="Keep my account" confirmLabel="Delete everything" onConfirm={() => {}} disabled />)
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeDisabled()

    rerender(<ConfirmDelete label="Delete my account" keepLabel="Keep my account" confirmLabel="Delete everything" onConfirm={() => {}} busy />)
    await user.click(screen.getByRole('button', { name: 'Delete my account' }))
    expect(screen.getByRole('button', { name: 'Keep my account' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Delete everything' })).toHaveAttribute('aria-busy', 'true')
  })
})
