import { describe, expect, it } from 'vitest'
import { cleanUrl, holdingsForBrief, hostOf, normalizeBrief, sameText, shouldRun, weekdayOf } from './brief.js'

// Made-up briefs in the shape the scheduled task sends – no real news.
const item = (headline, url = 'https://news.example.com/a', extra = {}) => ({ headline, url, ...extra })

describe('normalizeBrief', () => {
  it('keeps headings, headlines, links and the optional lines', () => {
    const { brief } = normalizeBrief('ibkr', {
      intro: 'Covered: VT, VWO',
      tickers: ['vt', 'VWO', 'VT', 'bad ticker'],
      sections: [{ heading: 'Global markets', items: [item('  Central bank   holds rates ', 'https://www.example.org/x', { source: 'Example' })] }],
    })
    expect(brief).toEqual({
      intro: 'Covered: VT, VWO',
      tickers: ['VT', 'VWO'],
      sections: [{ heading: 'Global markets', items: [{ headline: 'Central bank holds rates', url: 'https://www.example.org/x', source: 'Example' }] }],
    })
  })

  it('drops items without a headline or a real web link, and empty sections', () => {
    const { brief } = normalizeBrief('world', {
      summary: 'A calm day.',
      sections: [
        { heading: 'A', items: [item('ok'), item('no link', 'javascript:alert(1)'), item('', 'https://x.example'), { url: 'https://y.example' }] },
        { heading: 'B', items: [item('bad', 'data:text/html,hi')] },
      ],
    })
    expect(brief.sections).toHaveLength(1)
    expect(brief.sections[0].items).toEqual([{ headline: 'ok', url: 'https://news.example.com/a', source: 'news.example.com' }])
    expect(brief.summary).toBe('A calm day.')
  })

  it('keeps "why it matters" for the jobs brief and allows a quiet day without items', () => {
    expect(normalizeBrief('jobs', { sections: [{ heading: 'Economy', items: [item('Rates held', undefined, { why: 'Hiring may pick up.' })] }] }).brief.sections[0].items[0].why).toBe('Hiring may pick up.')
    expect(normalizeBrief('jobs', { quiet: true, intro: 'Quiet day.' }).brief).toEqual({ sections: [], intro: 'Quiet day.', quiet: true })
  })

  it('refuses unknown briefs and briefs without any usable headline', () => {
    expect(normalizeBrief('sports', { sections: [] }).error).toMatch(/unknown/)
    expect(normalizeBrief('world', null).error).toMatch(/object/)
    expect(normalizeBrief('world', { sections: [{ items: [item('x', 'ftp://a')] }] }).error).toMatch(/no usable headlines/)
  })

  it('caps the number of sections and items and the text length', () => {
    const many = Array.from({ length: 20 }, (_, index) => item(`h${index}`))
    const { brief } = normalizeBrief('world', { sections: Array.from({ length: 9 }, () => ({ heading: 'x'.repeat(100), items: many })) })
    expect(brief.sections).toHaveLength(6)
    expect(brief.sections[0].items).toHaveLength(12)
    expect(brief.sections[0].heading).toHaveLength(60)
  })
})

describe('helpers', () => {
  it('cleanUrl keeps only http(s) links; hostOf gives the site name', () => {
    expect(cleanUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(cleanUrl('javascript:alert(1)')).toBeNull()
    expect(cleanUrl('not a link')).toBeNull()
    expect(hostOf('https://www.example.com/a')).toBe('example.com')
  })

  it('shouldRun: off in Settings → no; IBKR only Tuesday to Saturday', () => {
    expect(weekdayOf('2026-11-01')).toBe(0) // a Sunday
    expect(shouldRun('ibkr', {}, '2026-11-01')).toBe(false)
    expect(shouldRun('ibkr', {}, '2026-11-03')).toBe(true) // Tuesday
    expect(shouldRun('ibkr', {}, '2026-11-02')).toBe(false) // Monday
    expect(shouldRun('jobs', { brief_jobs_on: true }, '2026-11-01')).toBe(true)
    expect(shouldRun('jobs', { brief_jobs_on: false }, '2026-11-01')).toBe(false)
    expect(shouldRun('world', {}, '2026-11-02')).toBe(true)
  })

  it('holdingsForBrief gives symbols and names only – no figures, no cash, no repeats', () => {
    const positions = [
      { symbol: 'VT', description: 'VANGUARD TOT WORLD STK ETF', asset_class: 'STK', quantity: 10, value_base: 1234 },
      { symbol: 'vt', description: 'again', asset_class: 'STK' },
      { symbol: 'CHF', description: 'Cash', asset_class: 'CASH', value_base: 50 },
    ]
    expect(holdingsForBrief(positions)).toEqual([{ symbol: 'VT', name: 'VANGUARD TOT WORLD STK ETF', asset_class: 'STK' }])
  })

  it('sameText compares exactly', () => {
    expect(sameText('abc', 'abc')).toBe(true)
    expect(sameText('abc', 'abd')).toBe(false)
    expect(sameText('abc', 'abcd')).toBe(false)
    expect(sameText(undefined, 'a')).toBe(false)
  })
})
