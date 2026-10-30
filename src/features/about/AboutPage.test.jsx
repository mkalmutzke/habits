// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TABLES } from '../../shared/data/tables.js'
import AboutPage from './AboutPage.jsx'
import { DATABASE_TABLES } from './databaseTables.js'

describe('How it’s built (v3 TS-S6)', () => {
  it('describes every table the app loads', () => {
    const described = DATABASE_TABLES.map((table) => table.name)
    for (const table of Object.keys(TABLES)) expect(described).toContain(table)
  })

  it('starts with the overview and switches topics with the dropdown', async () => {
    render(<AboutPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'How it’s built' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Overview' })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Topic' }), 'database')
    expect(screen.getByRole('region', { name: 'Database' })).toBeInTheDocument()
    expect(screen.getByText('shopping_items')).toBeInTheDocument()
    expect(screen.getByText('habit_reminders')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Topic' }), 'stack')
    expect(screen.getByText(/Version 3.5.0/)).toBeInTheDocument()
  })

  it('offers all seven topics', () => {
    render(<AboutPage />)
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Overview',
      'Building blocks',
      'Data flow',
      'Database',
      'Reminders',
      'Security & tests',
      'Tech stack',
    ])
  })
})
