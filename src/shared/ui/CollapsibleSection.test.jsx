// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSectionMemory, useSectionOpen } from '../hooks/useSectionOpen.js'
import CollapsibleSection from './CollapsibleSection.jsx'

function Card({ defaultOpen = false, alwaysOpen = false, onAdd = () => {} }) {
  const state = useSectionOpen('test-card', defaultOpen)
  return (
    <CollapsibleSection
      state={state}
      title="Habits"
      summary="2 of 4 today"
      alwaysOpen={alwaysOpen}
      actions={
        <button type="button" aria-label="Add a habit" onClick={onAdd}>
          +
        </button>
      }
    >
      <button type="button">Walk the dog</button>
    </CollapsibleSection>
  )
}

const toggle = () => screen.getByRole('button', { name: /^Habits/ })

describe('CollapsibleSection (v3.3 TS-F)', () => {
  beforeEach(resetSectionMemory)

  it('starts folded by default and shows title and summary in the header (TS-F1)', () => {
    render(<Card />)
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(toggle()).toHaveTextContent('2 of 4 today')
    expect(screen.queryByRole('button', { name: 'Walk the dog' })).toBeNull()
  })

  it('starts open when asked to (ToDo’s, Shopping)', () => {
    render(<Card defaultOpen />)
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Walk the dog' })).toBeVisible()
  })

  it.each(['Habits', '2 of 4 today'])('a tap on “%s” folds and unfolds (TS-F2)', async (text) => {
    const user = userEvent.setup()
    render(<Card />)
    await user.click(screen.getByText(text))
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByText(text))
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
  })

  it('＋ does its own thing and does not fold (TS-F3)', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<Card onAdd={onAdd} />)
    await user.click(screen.getByRole('button', { name: 'Add a habit' }))
    expect(onAdd).toHaveBeenCalledOnce()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
  })

  it('a tap inside the open card does not fold it (TS-F4)', async () => {
    const user = userEvent.setup()
    render(<Card defaultOpen />)
    await user.click(screen.getByRole('button', { name: 'Walk the dog' }))
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('Enter and Space toggle from the keyboard (TS-F5)', async () => {
    const user = userEvent.setup()
    render(<Card />)
    toggle().focus()
    await user.keyboard('{Enter}')
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard(' ')
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(toggle()).toHaveFocus()
  })

  it('remembers open or folded for the visit (TS-F6)', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Card />)
    await user.click(toggle())
    unmount()
    render(<Card />)
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('alwaysOpen keeps the body visible and the header can’t fold it (TS-F7)', () => {
    render(<Card alwaysOpen />)
    expect(toggle()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Walk the dog' })).toBeVisible()
  })

  it('is a section named by its title, with the toggle inside a heading', () => {
    render(<Card />)
    expect(screen.getByRole('region', { name: 'Habits' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toContainElement(toggle())
  })
})
