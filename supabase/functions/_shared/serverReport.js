// Server health (v3.8): pure helpers for server-ingest, no Deno or network
// code, so they can be unit-tested. A report comes from the health agent on
// the user's server (scripts/server-agent) – from outside, so every value is
// checked and trimmed here before it is stored. Unknown fields are dropped.

// The agent's token: 64 hex characters (32 random bytes).
export const isAgentToken = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)

// Bigger bodies are refused before they are read as JSON.
export const MAX_BODY = 8000

const MAX_SERVICES = 20
const SERVICE_NAME = /^[A-Za-z0-9@._:-]{1,60}$/

// A number in [min, max] (rounded to `digits` decimals), else null.
function number(value, min, max, digits = 2) {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed < min || parsed > max) return null
  const factor = 10 ** digits
  return Math.round(parsed * factor) / factor
}

const whole = (value, min, max) => number(value, min, max, 0)

// The watched services: [{ name, active }], at most 20, only plain names.
function services(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry) => entry && typeof entry.name === 'string' && SERVICE_NAME.test(entry.name))
    .slice(0, MAX_SERVICES)
    .map((entry) => ({ name: entry.name, active: entry.active === true }))
}

// The report as it is stored, or null if it isn't an object.
export function normalizeReport(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const memoryTotal = whole(body.memory_total_mb, 1, 16_000_000)
  const diskTotal = number(body.disk_total_gb, 0.01, 1_000_000)
  return {
    cpu: number(body.cpu, 0, 100, 1),
    load1: number(body.load1, 0, 10_000),
    load5: number(body.load5, 0, 10_000),
    load15: number(body.load15, 0, 10_000),
    memory_used_mb: memoryTotal === null ? null : whole(body.memory_used_mb, 0, memoryTotal),
    memory_total_mb: memoryTotal,
    disk_used_gb: diskTotal === null ? null : number(body.disk_used_gb, 0, diskTotal),
    disk_total_gb: diskTotal,
    uptime_s: whole(body.uptime_s, 0, 100 * 365 * 86_400),
    services: services(body.services),
    containers_running: whole(body.containers_running, 0, 100_000),
    containers_total: whole(body.containers_total, 0, 100_000),
    updates_pending: whole(body.updates_pending, 0, 100_000),
    reboot_required: typeof body.reboot_required === 'boolean' ? body.reboot_required : null,
    cert_days: whole(body.cert_days, -3650, 3650),
  }
}
