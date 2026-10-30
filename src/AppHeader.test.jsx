// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppHeader from './AppHeader.jsx'
import { headerLine } from './headerLine.js'

const TODAY = '2026-10-08' // a Thursday

describe('headerLine (v3 §2.1: one small line on every tab page)', () => {
  it('shows the date on What’s up?', () => {
    expect(headerLine('today', TODAY, 0)).toMatch(/8 October/)
  })

  it('shows the last 7 days on Week', () => {
    expect(headerLine('week', TODAY, 0)).toBe('Last 7 days · 2 Oct – 8 Oct')
  })

  it('shows the open tasks on Lists, singular and plural', () => {
    expect(headerLine('lists', TODAY, 1)).toBe('1 open task')
    expect(headerLine('lists', TODAY, 12)).toBe('12 open tasks')
  })
})

describe('AppHeader', () => {
  it.each([
    ['today', 'What’s up?'],
    ['week', 'Week'],
    ['lists', 'Lists'],
  ])('%s: top bar, one small line and the title – the same parts on every page (TS-W4)', (view, title) => {
    const { container } = render(<AppHeader today={TODAY} view={view} openTasks={3} />)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(container.querySelectorAll('.header-top')).toHaveLength(1)
    expect(container.querySelectorAll('.header-line')).toHaveLength(1)
    expect(container.querySelectorAll('.title-row')).toHaveLength(1)
    // nothing else that could change the height (v2 had a message and a progress line)
    expect(container.querySelector('header').children).toHaveLength(3)
  })

  it('has a gear link to Settings and no ⓘ button (TS-W2)', () => {
    render(<AppHeader today={TODAY} view="today" />)
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '#/settings')
    expect(screen.queryByRole('button', { name: /how (this app|it).s built/i })).not.toBeInTheDocument()
  })

  it('names the first tab “What’s up?” (TS-W1)', () => {
    render(<AppHeader today={TODAY} view="today" />)
    expect(screen.getByRole('tab', { name: 'What’s up?' })).toHaveAttribute('aria-selected', 'true')
  })
})
