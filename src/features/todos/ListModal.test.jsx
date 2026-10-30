// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import ListModal from './ListModal.jsx'

// jsdom has <dialog> but no showModal/close
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false
  }
})

const todos = () => ({ groups: [], tasks: [], addList: vi.fn(() => 'new-list'), updateList: vi.fn(), deleteList: vi.fn() })
const showInAll = () => screen.getByRole('combobox', { name: 'Show in All' })

describe('ListModal – Show in All (design v3.3 §3.3)', () => {
  it('a new list is in All by default; the hint follows the choice (TS-A3)', async () => {
    const user = userEvent.setup()
    render(<ListModal todos={todos()} onClose={() => {}} />)
    expect(showInAll()).toHaveValue('yes')
    expect(showInAll()).toHaveAccessibleDescription(/show up in All/)
    await user.selectOptions(showInAll(), 'no')
    expect(showInAll()).toHaveAccessibleDescription(/stay out of All/)
  })

  it('creating with “No” saves showInAll = false (TS-A4)', async () => {
    const user = userEvent.setup()
    const data = todos()
    render(<ListModal todos={data} onClose={() => {}} />)
    await user.type(screen.getByLabelText('List name'), 'Work')
    await user.selectOptions(showInAll(), 'no')
    await user.click(screen.getByRole('button', { name: 'Create list' }))
    expect(data.addList).toHaveBeenCalledWith(expect.objectContaining({ name: 'Work', showInAll: false }))
  })

  it('editing shows the saved choice and saves the change (TS-A4)', async () => {
    const user = userEvent.setup()
    const data = todos()
    const list = { id: 'work', name: 'Work', color: 'blue', group_id: null, show_in_all: false }
    render(<ListModal todos={data} list={list} onClose={() => {}} />)
    expect(showInAll()).toHaveValue('no')
    await user.selectOptions(showInAll(), 'yes')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(data.updateList).toHaveBeenCalledWith('work', expect.objectContaining({ show_in_all: true }))
  })

  it('a list cached before v3.3 (no field) counts as “Yes”', () => {
    render(<ListModal todos={todos()} list={{ id: 'old', name: 'Old', color: 'amber', group_id: null }} onClose={() => {}} />)
    expect(showInAll()).toHaveValue('yes')
  })
})
