// Reading IBKR Flex reports (v3.4).
// Flex XML keeps its data in attributes of known elements, e.g.
//   <OpenPosition symbol="MSFT" position="21" markPrice="412.5" … />
// so a small reader is enough – no XML package. Plain functions
// without Deno or network, so they are unit-tested with made-up reports.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, code) => {
    if (code[0] !== '#') return ENTITIES[code] ?? match
    return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)))
  })
}

// The attributes of every <tag …> element, in document order.
// (`\b` keeps <OpenPositions> apart from <OpenPosition>.)
export function elements(xml, tag) {
  const pattern = new RegExp(`<${tag}\\b([^>]*?)/?>`, 'g')
  return [...xml.matchAll(pattern)].map(([, attributes]) =>
    Object.fromEntries([...attributes.matchAll(/([\w:.-]+)="([^"]*)"/g)].map(([, name, value]) => [name, decode(value)])),
  )
}

// The text of the first <tag>text</tag>, or null.
export function textOf(xml, tag) {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml)
  return match ? decode(match[1]).trim() : null
}

// "1,234.5" → 1234.5; empty, "--" or not a number → null.
export function number(value) {
  if (value === undefined || value === null) return null
  const cleaned = String(value).replace(/,/g, '').trim()
  if (cleaned === '' || cleaned === '--') return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

// Amounts are stored to the cent (also hides floating-point noise like 80.00000000000003).
const cents = (value) => (value === null ? null : Math.round(value * 100) / 100)

// Flex dates as "YYYY-MM-DD": "20261027", "2026-10-27" (a time after ";" or "," is ignored).
export function flexDate(value) {
  const day = String(value ?? '').split(/[;,\s]/)[0]
  if (/^\d{8}$/.test(day)) return `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day
  return null
}

// The answer of SendRequest / GetStatement while there is no report (yet):
// { status: 'Success' | 'Warn' | 'Fail', code, message, reference, url }
export function responseStatus(xml) {
  return {
    status: textOf(xml, 'Status'),
    code: textOf(xml, 'ErrorCode'),
    message: textOf(xml, 'ErrorMessage'),
    reference: textOf(xml, 'ReferenceCode'),
    url: textOf(xml, 'Url'),
  }
}

// Is this the report itself (and not a "please wait" answer)?
export const isStatement = (xml) => xml.includes('<FlexQueryResponse')

function statementOf(xml) {
  const statement = elements(xml, 'FlexStatement')[0]
  if (!statement) throw new Error('Flex report has no FlexStatement')
  return statement
}

function changeInNav(xml) {
  const nav = elements(xml, 'ChangeInNAV')[0]
  if (!nav) throw new Error('Flex report has no "Change in NAV" section – add it to the query')
  return nav
}

// The daily report (period "last business day") → what store_portfolio_snapshot takes.
// Amounts of a position are in its own currency in Flex; fxRateToBase turns them into
// the base currency. "Today" of a position compares its close with the previous close.
export function parseDailyStatement(xml) {
  const statement = statementOf(xml)
  const nav = changeInNav(xml)
  const account = elements(xml, 'AccountInformation')[0] ?? {}
  const baseCash = elements(xml, 'CashReportCurrency').find((row) => row.currency === 'BASE_SUMMARY')
  const starting = number(nav.startingValue)
  const ending = number(nav.endingValue)
  if (ending === null) throw new Error('Flex report has no ending value in "Change in NAV"')

  const previousClose = new Map(
    elements(xml, 'MTMPerformanceSummaryUnderlying').map((row) => [row.conid || row.symbol, number(row.prevClosePrice)]),
  )

  const positions = elements(xml, 'OpenPosition')
    .filter((row) => !row.levelOfDetail || row.levelOfDetail === 'SUMMARY')
    .map((row) => {
      const fx = number(row.fxRateToBase) ?? 1
      const inBase = (value) => (number(value) === null ? null : cents(number(value) * fx))
      const markPrice = number(row.markPrice)
      const prevClose = previousClose.get(row.conid || row.symbol) ?? null
      const valueBase = inBase(row.positionValue) ?? 0
      return {
        symbol: row.symbol,
        description: row.description ?? null,
        asset_class: row.assetCategory ?? null,
        currency: row.currency ?? null,
        quantity: number(row.position) ?? 0,
        mark_price: markPrice,
        prev_close_price: prevClose,
        value_base: valueBase,
        // the price move of the day, in base currency (the currency's own move is left out)
        day_change_base: markPrice && prevClose ? cents(valueBase * (1 - prevClose / markPrice)) : null,
        cost_basis_base: inBase(row.costBasisMoney),
        unrealized_base: inBase(row.fifoPnlUnrealized),
      }
    })

  return {
    snapshot: {
      as_of: flexDate(statement.toDate),
      base_currency: account.currency || nav.currency || null,
      nav: ending,
      cash: baseCash ? number(baseCash.endingCash) : null,
      // the day's move without money paid in or out
      day_change: starting === null ? null : cents(ending - starting - (number(nav.depositsWithdrawals) ?? 0)),
      day_twr: number(nav.twr),
    },
    positions,
  }
}

// The performance report (period "year to date") → IBKR's time-weighted return.
export function parsePerformanceStatement(xml) {
  const statement = statementOf(xml)
  const nav = changeInNav(xml)
  return { twr: number(nav.twr), twr_from: flexDate(statement.fromDate), twr_to: flexDate(statement.toDate) }
}

// The trading day a report fetched on `todayKey` ("YYYY-MM-DD", UTC) should be
// about: the weekday before (Tuesday → Monday, Saturday → Friday, Monday → Friday).
// Holidays are not known here – then the stored day is simply older.
export function expectedTradingDay(todayKey) {
  const date = new Date(`${todayKey}T12:00:00Z`)
  do date.setUTCDate(date.getUTCDate() - 1)
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6)
  return date.toISOString().slice(0, 10)
}
