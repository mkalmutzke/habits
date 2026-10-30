import { describe, expect, it } from 'vitest'
import {
  elements,
  expectedTradingDay,
  flexDate,
  isStatement,
  number,
  parseDailyStatement,
  parsePerformanceStatement,
  responseStatus,
} from './flex.js'

// Made-up reports in the shape of IBKR's Flex XML – no real account data.
const DAILY = `<?xml version="1.0" encoding="UTF-8"?>
<FlexQueryResponse queryName="habits-daily" type="AF">
<FlexStatements count="1">
<FlexStatement accountId="U0000000" fromDate="20261027" toDate="20261027" period="LastBusinessDay" whenGenerated="20261028;021503">
<AccountInformation accountId="U0000000" currency="CHF" />
<ChangeInNAV accountId="U0000000" currency="CHF" startingValue="10,000" mtm="120" depositsWithdrawals="500" endingValue="10,620" twr="1.2" />
<CashReport>
<CashReportCurrency currency="BASE_SUMMARY" endingCash="1,000" />
<CashReportCurrency currency="USD" endingCash="200" />
</CashReport>
<OpenPositions>
<OpenPosition currency="USD" fxRateToBase="0.8" assetCategory="STK" symbol="TEST" conid="111" description="TEST &amp; CO" position="10" markPrice="110" positionValue="1100" costBasisMoney="1000" fifoPnlUnrealized="100" levelOfDetail="SUMMARY" />
<OpenPosition currency="USD" fxRateToBase="0.8" assetCategory="STK" symbol="TEST" conid="111" description="TEST &amp; CO" position="10" markPrice="110" positionValue="1100" levelOfDetail="LOT" />
<OpenPosition currency="CHF" fxRateToBase="1" assetCategory="STK" symbol="NEWX" conid="222" description="New listing" position="5" markPrice="20" positionValue="100" costBasisMoney="--" fifoPnlUnrealized="" levelOfDetail="SUMMARY" />
</OpenPositions>
<MTMPerformanceSummaryInBase>
<MTMPerformanceSummaryUnderlying symbol="TEST" conid="111" prevClosePrice="100" closePrice="110" />
</MTMPerformanceSummaryInBase>
</FlexStatement>
</FlexStatements>
</FlexQueryResponse>`

const PERFORMANCE = `<FlexQueryResponse queryName="habits-ytd" type="AF"><FlexStatements count="1">
<FlexStatement accountId="U0000000" fromDate="20260101" toDate="20261027" period="YearToDate">
<ChangeInNAV currency="CHF" startingValue="9000" endingValue="10620" twr="9.6" />
</FlexStatement></FlexStatements></FlexQueryResponse>`

describe('small readers', () => {
  it('elements: attributes in order, entities decoded, plural tags kept apart', () => {
    const rows = elements(DAILY, 'OpenPosition')
    expect(rows).toHaveLength(3)
    expect(rows[0].description).toBe('TEST & CO')
    expect(elements(DAILY, 'OpenPositions')).toHaveLength(1)
  })

  it('number: commas, empty and "--"', () => {
    expect(number('10,620.5')).toBe(10620.5)
    expect(number('-3')).toBe(-3)
    expect(number('')).toBeNull()
    expect(number('--')).toBeNull()
    expect(number(undefined)).toBeNull()
  })

  it('flexDate: both date formats, with or without time', () => {
    expect(flexDate('20261027')).toBe('2026-10-27')
    expect(flexDate('20261028;021503')).toBe('2026-10-28')
    expect(flexDate('2026-10-27')).toBe('2026-10-27')
    expect(flexDate('10/27/2026')).toBeNull()
  })

  it('responseStatus: reference while waiting, error code when it fails', () => {
    const sent = responseStatus('<FlexStatementResponse><Status>Success</Status><ReferenceCode>123</ReferenceCode><Url>https://example.test/GetStatement</Url></FlexStatementResponse>')
    expect(sent).toMatchObject({ status: 'Success', reference: '123', url: 'https://example.test/GetStatement' })
    const failed = responseStatus('<FlexStatementResponse><Status>Fail</Status><ErrorCode>1012</ErrorCode><ErrorMessage>Token has expired.</ErrorMessage></FlexStatementResponse>')
    expect(failed).toMatchObject({ status: 'Fail', code: '1012', message: 'Token has expired.' })
    expect(isStatement(DAILY)).toBe(true)
    expect(isStatement('<FlexStatementResponse><Status>Warn</Status></FlexStatementResponse>')).toBe(false)
  })
})

describe('parseDailyStatement', () => {
  const { snapshot, positions } = parseDailyStatement(DAILY)

  it('snapshot: day, base currency, value, cash, the day’s move without the deposit', () => {
    expect(snapshot).toEqual({ as_of: '2026-10-27', base_currency: 'CHF', nav: 10620, cash: 1000, day_change: 120, day_twr: 1.2 })
  })

  it('positions: summary rows only, amounts in base currency', () => {
    expect(positions.map((row) => row.symbol)).toEqual(['TEST', 'NEWX'])
    expect(positions[0]).toEqual({
      symbol: 'TEST',
      description: 'TEST & CO',
      asset_class: 'STK',
      currency: 'USD',
      quantity: 10,
      mark_price: 110,
      prev_close_price: 100,
      value_base: 880,
      day_change_base: 80,
      cost_basis_base: 800,
      unrealized_base: 80,
    })
  })

  it('a position without previous close or cost basis keeps those empty', () => {
    expect(positions[1]).toMatchObject({ prev_close_price: null, day_change_base: null, cost_basis_base: null, unrealized_base: null, value_base: 100 })
  })

  it('a query without "Change in NAV" says what is missing', () => {
    expect(() => parseDailyStatement(DAILY.replace(/<ChangeInNAV[^>]*>/, ''))).toThrow(/Change in NAV/)
  })
})

describe('parsePerformanceStatement', () => {
  it('TWR and its period', () => {
    expect(parsePerformanceStatement(PERFORMANCE)).toEqual({ twr: 9.6, twr_from: '2026-01-01', twr_to: '2026-10-27' })
  })
})

describe('expectedTradingDay', () => {
  it('the weekday before; Monday and Sunday go back to Friday', () => {
    expect(expectedTradingDay('2026-10-28')).toBe('2026-10-27') // Wed → Tue
    expect(expectedTradingDay('2026-10-31')).toBe('2026-10-30') // Sat → Fri
    expect(expectedTradingDay('2026-11-02')).toBe('2026-10-30') // Mon → Fri
    expect(expectedTradingDay('2027-01-01')).toBe('2026-12-31') // across the year
  })
})
