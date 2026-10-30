// IBKR Flex Web Service (v3.4): ask for a report, then fetch it once
// IBKR has built it. Two plain HTTPS calls, no packages. The URLs
// carry the token, so they are never logged – errors name only IBKR's code
// and message.
import { isStatement, responseStatus } from './flex.js'

const SERVICE = 'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService'
// IBKR refuses requests without a User-Agent
const HEADERS = { 'User-Agent': 'habits-app/3.4 (ibkr-sync)' }
const TRIES = 10
const WAIT_MS = 3000

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function get(url: string): Promise<string> {
  const response = await fetch(url, { headers: HEADERS })
  const text = await response.text()
  if (!response.ok) throw new Error(`Flex: HTTP ${response.status}`)
  return text
}

function failure(step: string, xml: string): Error {
  const { status, code, message } = responseStatus(xml)
  return new Error(`Flex ${step}: ${status ?? 'no status'}${code ? ` ${code}` : ''}${message ? ` – ${message}` : ''}`)
}

// The XML of one Flex query's report.
export async function fetchStatement(token: string, queryId: string): Promise<string> {
  const query = (reference: string) => `t=${encodeURIComponent(token)}&q=${encodeURIComponent(reference)}&v=3`
  const sent = await get(`${SERVICE}/SendRequest?${query(queryId)}`)
  const { status, reference, url } = responseStatus(sent)
  if (status !== 'Success' || !reference) throw failure('SendRequest', sent)

  for (let attempt = 1; attempt <= TRIES; attempt += 1) {
    await wait(WAIT_MS)
    const xml = await get(`${url || `${SERVICE}/GetStatement`}?${query(reference)}`)
    if (isStatement(xml)) return xml
    // "Warn" = the report is still being built; anything else is a real error
    if (responseStatus(xml).status !== 'Warn') throw failure('GetStatement', xml)
  }
  throw new Error(`Flex GetStatement: report not ready after ${TRIES} tries`)
}
