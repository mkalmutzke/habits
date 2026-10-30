import { useMemo } from 'react'
import { useTable } from '../../shared/data/hooks.js'
import { currentPortfolio } from './portfolio.js'

// The IBKR portfolio (v3.4): the newest snapshot and its holdings, or
// `current: null` while ibkr-sync has not stored one yet. Read-only – the app
// never changes these tables.
export function usePortfolio() {
  const snapshots = useTable('portfolio_snapshots')
  const positions = useTable('portfolio_positions')
  const current = useMemo(() => currentPortfolio(snapshots.rows, positions.rows), [snapshots.rows, positions.rows])
  return { current, loading: snapshots.loading || positions.loading }
}
