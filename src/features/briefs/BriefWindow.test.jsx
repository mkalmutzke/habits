// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import BriefWindow from './BriefWindow.jsx'

// jsdom has <dialog> but no showModal/close
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false
  }
})

const TODAY = '2026-11-03'
// Made-up briefs – no real news.
const brief = (content, values = {}) => ({ id: 'b1', for_day: TODAY, seen_on: null, updated_at: null, content, ...values })
const item = (headline, extra = {}) => ({ headline, url: 'https://news.example.com/a', source: 'example.com', ...extra })

function renderWindow(kind, value, onSeen = vi.fn()) {
  render(<BriefWindow kind={kind} brief={value} today={TODAY} onSeen={onSeen} onClose={() => {}} />)
  return onSeen
}

describe('BriefWindow (v3.6)', () => {
  it('IBKR: tickers, the fallback note and headlines under headings, each a link to its source', () => {
    renderWindow(
      'ibkr',
      brief({
        note: 'The positions could not be read – using VT and VWO.',
        tickers: ['VT', 'VWO'],
        sections: [{ heading: 'Global markets & macro', items: [item('Central bank holds rates')] }],
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Morning brief' })
    expect(within(dialog).getByText('The positions could not be read – using VT and VWO.')).toBeInTheDocument()
    expect(within(dialog).getByText('VWO')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Global markets & macro' })).toBeInTheDocument()
    const link = within(dialog).getByRole('link', { name: /Central bank holds rates/ })
    expect(link).toHaveAttribute('href', 'https://news.example.com/a')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('opening marks it as seen for today', () => {
    const onSeen = renderWindow('jobs', brief({ sections: [{ heading: 'Economy', items: [item('Rates held', { why: 'Hiring may pick up.' })] }] }))
    expect(onSeen).toHaveBeenCalledWith('jobs', TODAY)
    expect(screen.getByText('Why it matters: Hiring may pick up.')).toBeInTheDocument()
  })

  it('world news: a short summary and one numbered list', () => {
    renderWindow('world', brief({ summary: 'A calm day.', sections: [{ heading: 'A', items: [item('One')] }, { heading: 'B', items: [item('Two', { url: 'https://b.example.com' })] }] }))
    expect(screen.getByText('A calm day.')).toBeInTheDocument()
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(list).toHaveTextContent('01One')
    expect(list).toHaveTextContent('02Two')
  })

  it('an older brief is marked "from yesterday"', () => {
    renderWindow('world', brief({ sections: [{ heading: 'A', items: [item('One')] }] }, { for_day: '2026-11-02' }))
    expect(screen.getByText('From yesterday · Mon 2 Nov')).toBeInTheDocument()
    expect(screen.getByText(/today’s hasn’t arrived/)).toBeInTheDocument()
  })

  it('a quiet day says so; no brief yet says when the first one comes', () => {
    renderWindow('jobs', brief({ quiet: true, sections: [] }))
    expect(screen.getByText('A quiet day – nothing worth flagging.')).toBeInTheDocument()
  })

  it('without a brief: nothing is marked as seen', () => {
    const onSeen = renderWindow('ibkr', null)
    expect(screen.getByText(/No brief yet/)).toBeInTheDocument()
    expect(onSeen).not.toHaveBeenCalled()
  })
})
