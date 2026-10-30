// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import HabitModal from './HabitModal.jsx'

// jsdom has <dialog> but no showModal/close
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false
  }
})

function renderModal(props = {}) {
  const onAdd = vi.fn()
  render(<HabitModal open onClose={() => {}} onAdd={onAdd} defaultTime="09:00" defaultChannels={['inapp']} {...props} />)
  return onAdd
}

// Like Chrome's picker on Android: the field's value changes, but no event reaches React.
function setValueSilently(input, value) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
}

describe('HabitModal – daily reminder (v3 TS-R1)', () => {
  it('saves the time that is in the field, even if the app missed the change (v3.0.2)', async () => {
    const onAdd = renderModal()
    await userEvent.type(screen.getByLabelText('Habit name'), 'Test')
    await userEvent.click(screen.getByRole('button', { name: 'Daily reminder' }))
    const time = screen.getByLabelText('Time')
    setValueSilently(time, '16:02')
    // something else re-renders the dialog before saving
    await userEvent.click(screen.getByRole('button', { name: 'Email' }))
    expect(time).toHaveValue('16:02')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onAdd).toHaveBeenCalledWith({ name: 'Test', subtitle: '', emoji: '🐕' }, { remind_time: '16:02:00', channels: ['inapp', 'email'] })
  })

  it('shows the time that will be saved', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Daily reminder' }))
    expect(screen.getByText('Daily at 09:00, only if not done yet')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '18:30' } })
    expect(screen.getByText('Daily at 18:30, only if not done yet')).toBeInTheDocument()
  })

  it('keeps an existing reminder’s time when editing', async () => {
    const onAdd = renderModal({ initialName: 'Walk', initialReminder: { remind_time: '07:15:00', channels: ['push'], active: true } })
    expect(screen.getByLabelText('Time')).toHaveValue('07:15')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onAdd).toHaveBeenCalledWith({ name: 'Walk', subtitle: '', emoji: '🐕' }, { remind_time: '07:15:00', channels: ['push'] })
  })

  it('switched off: no reminder', async () => {
    const onAdd = renderModal({ initialName: 'Walk' })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onAdd).toHaveBeenCalledWith({ name: 'Walk', subtitle: '', emoji: '🐕' }, null)
  })

  it('saves an optional subtitle, trimmed (v3.1)', async () => {
    const onAdd = renderModal({ initialName: 'Gym', initialSubtitle: 'Legs' })
    expect(screen.getByLabelText('Subtitle (optional)')).toHaveValue('Legs')
    await userEvent.clear(screen.getByLabelText('Subtitle (optional)'))
    await userEvent.type(screen.getByLabelText('Subtitle (optional)'), '  2 × 20 minutes ')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onAdd).toHaveBeenCalledWith({ name: 'Gym', subtitle: '2 × 20 minutes', emoji: '🐕' }, null)
  })
})
