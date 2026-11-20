import { describe, expect, it } from 'vitest'
import {
  atOperationalTime,
  currentOperationalDate,
  formatTime,
  parseClock,
  parseDmy,
  parseMdy,
} from '../src/utils/time'

describe('horas y día operativo', () => {
  it('acepta la hora 0 y el mediodía', () => {
    expect(parseClock('0:03AM')).toEqual({ hour: 0, minute: 3, second: 0 })
    expect(parseClock('12:45PM')).toEqual({ hour: 12, minute: 45, second: 0 })
    expect(parseClock('12:00AM')).toEqual({ hour: 0, minute: 0, second: 0 })
    expect(parseClock('06:00 AM')).toEqual({ hour: 6, minute: 0, second: 0 })
    expect(parseClock('12:28:41PM')).toEqual({ hour: 12, minute: 28, second: 41 })
    expect(parseClock('0:03PM')).toBeNull()
    expect(parseClock('13:10PM')).toBeNull()
  })

  it('pasa al día siguiente solo las horas anteriores a las 6', () => {
    expect(atOperationalTime('2026-11-18', { hour: 14, minute: 55, second: 0 })).toBe('2026-11-18T14:55:00-06:00')
    expect(atOperationalTime('2026-11-18', { hour: 0, minute: 3, second: 0 })).toBe('2026-11-19T00:03:00-06:00')
    expect(atOperationalTime('2026-11-18', { hour: 5, minute: 45, second: 0 })).toBe('2026-11-19T05:45:00-06:00')
  })

  it('no confunde día/mes con mes/día', () => {
    expect(parseDmy('11/12/2026')).toBe('2026-12-11')
    expect(parseMdy('12/11/2026')).toBe('2026-12-11')
    expect(parseMdy('11/12/2026')).toBe('2026-11-12')
    expect(parseDmy('31/02/2026')).toBeNull()
  })

  it('muestra 12:03 AM para la medianoche del reporte', () => {
    expect(formatTime('2026-11-19T00:03:00-06:00')).toBe('12:03 AM')
    expect(formatTime('2026-11-18T14:55:00-06:00')).toBe('2:55 PM')
    expect(formatTime('2026-11-18T12:28:41-06:00')).toBe('12:28 PM')
  })

  it('elige el día operativo vigente', () => {
    expect(currentOperationalDate(new Date('2026-11-18T12:00:00-06:00'))).toBe('2026-11-18')
    expect(currentOperationalDate(new Date('2026-11-19T05:30:00-06:00'))).toBe('2026-11-18')
    expect(currentOperationalDate(new Date('2026-11-19T06:00:00-06:00'))).toBe('2026-11-19')
    expect(currentOperationalDate(new Date('2026-11-18T05:59:00-06:00'))).toBe('2026-11-17')
  })
})
