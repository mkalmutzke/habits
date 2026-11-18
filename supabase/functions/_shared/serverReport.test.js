import { describe, expect, it } from 'vitest'
import { isAgentToken, normalizeReport } from './serverReport.js'

describe('server reports (v3.8)', () => {
  it('accepts only 64 hex characters as agent token', () => {
    expect(isAgentToken('a'.repeat(64))).toBe(true)
    expect(isAgentToken('A'.repeat(64))).toBe(false)
    expect(isAgentToken('a'.repeat(63))).toBe(false)
    expect(isAgentToken(undefined)).toBe(false)
  })

  it('keeps a normal report, rounded', () => {
    const report = normalizeReport({
      cpu: 12.345,
      load1: '0.31',
      load5: 0.28,
      load15: 0.22,
      memory_used_mb: 3100,
      memory_total_mb: 8000,
      disk_used_gb: 130.456,
      disk_total_gb: 160,
      uptime_s: 2000000,
      services: [{ name: 'nginx', active: true }, { name: 'docker.service', active: false }],
      containers_running: 7,
      containers_total: 8,
      updates_pending: 12,
      reboot_required: true,
      cert_days: 54,
    })
    expect(report).toEqual({
      cpu: 12.3,
      load1: 0.31,
      load5: 0.28,
      load15: 0.22,
      memory_used_mb: 3100,
      memory_total_mb: 8000,
      disk_used_gb: 130.46,
      disk_total_gb: 160,
      uptime_s: 2000000,
      services: [{ name: 'nginx', active: true }, { name: 'docker.service', active: false }],
      containers_running: 7,
      containers_total: 8,
      updates_pending: 12,
      reboot_required: true,
      cert_days: 54,
    })
  })

  it('drops impossible values, odd service names and unknown fields', () => {
    const report = normalizeReport({
      cpu: 140,
      memory_used_mb: 9000,
      memory_total_mb: 8000,
      disk_used_gb: 10,
      services: [{ name: 'ok', active: 'yes' }, { name: '<script>' }, 'nginx', ...Array.from({ length: 30 }, (_, index) => ({ name: `s${index}`, active: true }))],
      reboot_required: 'no',
      secret: 'x',
    })
    expect(report.cpu).toBe(null)
    expect(report.memory_used_mb).toBe(null)
    expect(report.disk_used_gb).toBe(null)
    expect(report.services).toHaveLength(20)
    expect(report.services[0]).toEqual({ name: 'ok', active: false })
    expect(report.reboot_required).toBe(null)
    expect(report).not.toHaveProperty('secret')
  })

  it('refuses anything but an object', () => {
    expect(normalizeReport(null)).toBe(null)
    expect(normalizeReport([1])).toBe(null)
    expect(normalizeReport('cpu=1')).toBe(null)
  })
})
