import { describe, expect, it } from 'vitest'
import { cpuLine, formatAge, formatUptime, latestReports, serverStatus, worstTone } from './serverStatus.js'

const now = new Date('2026-11-18T12:00:00Z')
const server = { id: 's1', cpu_warn: 90, memory_warn: 90, disk_warn: 80 }
const minutesAgo = (minutes) => new Date(now.getTime() - minutes * 60_000).toISOString()
const report = (values = {}) => ({
  server_id: 's1',
  reported_at: minutesAgo(2),
  cpu: 12,
  memory_used_mb: 3100,
  memory_total_mb: 8000,
  disk_used_gb: 100,
  disk_total_gb: 160,
  services: [{ name: 'nginx', active: true }],
  updates_pending: 0,
  reboot_required: false,
  cert_days: 54,
  ...values,
})

describe('serverStatus (v3.8)', () => {
  it('waits for the first report, then says all fine', () => {
    expect(serverStatus(server, undefined, now)).toMatchObject({ tone: 'none', headline: 'Waiting for the first report' })
    expect(serverStatus(server, report(), now)).toMatchObject({ tone: 'ok', headline: 'All fine', memory: 39, disk: 63 })
  })

  it('warns when a limit is crossed, a service stopped or the certificate ends soon', () => {
    expect(serverStatus(server, report({ disk_used_gb: 130 }), now)).toMatchObject({ tone: 'warn', headline: 'Disk at 81 % – above your 80 % limit' })
    expect(serverStatus(server, report({ cpu: 95 }), now).headline).toBe('CPU at 95 % – above your 90 % limit')
    expect(serverStatus(server, report({ services: [{ name: 'nginx', active: false }] }), now).headline).toBe('nginx is not running')
    expect(serverStatus(server, report({ cert_days: 5 }), now).headline).toBe('TLS certificate ends in 5 days')
    expect(serverStatus(server, report({ cert_days: -1 }), now).headline).toBe('TLS certificate has expired')
    expect(serverStatus({ ...server, disk_warn: 60 }, report(), now).tone).toBe('warn')
  })

  it('updates and a needed restart are notes, not warnings', () => {
    const status = serverStatus(server, report({ updates_pending: 12, reboot_required: true }), now)
    expect(status.tone).toBe('ok')
    expect(status.notes).toEqual(['12 updates pending', 'restart needed'])
  })

  it('is down without a report for more than 15 minutes', () => {
    expect(serverStatus(server, report({ reported_at: minutesAgo(15) }), now).tone).toBe('ok')
    expect(serverStatus(server, report({ reported_at: minutesAgo(17) }), now)).toMatchObject({ tone: 'down', headline: 'No report for 17 min' })
  })
})

describe('server helpers (v3.8)', () => {
  it('finds the newest report per server', () => {
    const latest = latestReports([report({ reported_at: minutesAgo(10), cpu: 1 }), report({ cpu: 2 }), report({ server_id: 's2', cpu: 3 })])
    expect(latest.get('s1').cpu).toBe(2)
    expect(latest.get('s2').cpu).toBe(3)
  })

  it('takes the worst tone for the header dot', () => {
    expect(worstTone([])).toBe('none')
    expect(worstTone(['ok', 'warn', 'ok'])).toBe('warn')
    expect(worstTone(['warn', 'down'])).toBe('down')
  })

  it('formats ages and uptimes', () => {
    expect(formatAge(0.5)).toBe('just now')
    expect(formatAge(125)).toBe('2 h 5 min')
    expect(formatAge(60 * 72)).toBe('3 days')
    expect(formatUptime(2_000_000)).toBe('23 d 3 h')
    expect(formatUptime(3700)).toBe('1 h 1 min')
  })

  it('draws the CPU line of the last 24 hours', () => {
    const reports = [report({ reported_at: minutesAgo(60 * 30), cpu: 50 }), report({ reported_at: minutesAgo(120), cpu: 0 }), report({ reported_at: minutesAgo(0), cpu: 100 })]
    expect(cpuLine(reports, 's1', now)).toBe('0.0,23.0 100.0,1.0')
    expect(cpuLine(reports.slice(0, 2), 's1', now)).toBe('')
  })
})
