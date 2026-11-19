import { describe, expect, it } from 'vitest'
import { shiftReportToOperationalDate } from '../src/services/schedule/reuseDay'
import type { ParsedReport } from '../src/types'
import { makeSession } from './support'

const report: ParsedReport = {
  reportType: 'finish-time',
  operationalDate: '2026-11-18',
  rangeStart: '2026-11-18T06:00:00-06:00',
  rangeEnd: '2026-11-19T06:00:00-06:00',
  generatedAt: '2026-11-18T12:28:41-06:00',
  sessions: [
    makeSession({
      screen: 10,
      title: 'La Venganza Del Charro Negro',
      start: '2026-11-18T13:10:00-06:00',
      feature: '2026-11-18T13:30:00-06:00',
      finish: '2026-11-18T14:55:00-06:00',
    }),
    makeSession({
      screen: 1,
      title: 'Los Juegos Del Hambre: Amanecer',
      start: '2026-11-18T21:05:00-06:00',
      feature: '2026-11-18T21:25:00-06:00',
      finish: '2026-11-19T00:03:00-06:00',
      language: 'Sub',
    }),
  ],
}

describe('reutilizar el PDF en otro día operativo', () => {
  it('conserva la hora de reloj y mueve la medianoche al día siguiente', () => {
    const shifted = shiftReportToOperationalDate(report, '2026-11-21')
    expect(shifted.operationalDate).toBe('2026-11-21')
    expect(shifted.rangeStart).toBe('2026-11-21T06:00:00-06:00')
    expect(shifted.rangeEnd).toBe('2026-11-22T06:00:00-06:00')
    expect(shifted.generatedAt).toBe('2026-11-21T12:28:41-06:00')
    expect(shifted.sessions[0].start).toBe('2026-11-21T13:10:00-06:00')
    expect(shifted.sessions[0].finish).toBe('2026-11-21T14:55:00-06:00')
    expect(shifted.sessions[0].id).toBe('2026-11-21|10|2026-11-21T13:10:00-06:00')
    expect(shifted.sessions[1].finish).toBe('2026-11-22T00:03:00-06:00')
    expect(shifted.sessions[1].start).toBe('2026-11-21T21:05:00-06:00')
  })

  it('no altera el reporte si ya corresponde a ese día', () => {
    expect(shiftReportToOperationalDate(report, '2026-11-18')).toBe(report)
  })
})
