import { DateTime } from 'luxon'

/** Guadalajara no usa horario de verano desde 2022; igual se respeta la zona. */
export const ZONE = 'America/Mexico_City'

export type ClockTime = { hour: number; minute: number; second: number }

/** Acepta 2:55PM, 0:03AM, 06:00 AM y 12:28:41PM. La hora 0 es medianoche. */
export function parseClock(raw: string): ClockTime | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!match) return null
  const minute = Number(match[2])
  const second = match[3] ? Number(match[3]) : 0
  if (minute > 59 || second > 59) return null
  let hour = Number(match[1])
  const pm = match[4].toUpperCase() === 'PM'
  if (pm) {
    if (hour === 12) hour = 12
    else if (hour >= 1 && hour <= 11) hour += 12
    else return null
  } else if (hour === 12) {
    hour = 0
  } else if (hour === 0 || (hour >= 1 && hour <= 11)) {
    hour = hour
  } else {
    return null
  }
  return { hour, minute, second }
}

export function calendarDate(day: number, month: number, year: number): string | null {
  const dt = DateTime.fromObject({ year, month, day }, { zone: ZONE })
  if (!dt.isValid || dt.day !== day || dt.month !== month || dt.year !== year) return null
  return dt.toISODate()
}

/** Encabezado From/Until: día/mes/año. */
export function parseDmy(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  return calendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
}

/** Fila de fecha y pie: mes/día/año. */
export function parseMdy(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  return calendarDate(Number(match[2]), Number(match[1]), Number(match[3]))
}

function zoned(isoDate: string, clock: ClockTime): DateTime {
  const [year, month, day] = isoDate.split('-').map(Number)
  const dt = DateTime.fromObject(
    {
      year,
      month,
      day,
      hour: clock.hour,
      minute: clock.minute,
      second: clock.second,
      millisecond: 0,
    },
    { zone: ZONE },
  )
  if (!dt.isValid) throw new Error('Fecha inválida')
  return dt
}

function isoOf(dt: DateTime): string {
  const iso = dt.toISO({ suppressMilliseconds: true })
  if (!iso) throw new Error('No se pudo convertir la hora')
  return iso
}

/** Fecha y hora civiles, sin recorrer la medianoche. Sirve para el rango y el pie. */
export function atCivilTime(isoDate: string, clock: ClockTime): string {
  return isoOf(zoned(isoDate, clock))
}

/** Hora de una función: antes de las 6:00 pertenece al día civil siguiente. */
export function atOperationalTime(operationalDate: string, clock: ClockTime): string {
  const dt = zoned(operationalDate, clock)
  return isoOf(clock.hour < 6 ? dt.plus({ days: 1 }) : dt)
}

export function formatTime(iso: string): string {
  const dt = DateTime.fromISO(iso, { setZone: true }).setZone(ZONE)
  const suffix = dt.hour < 12 ? 'AM' : 'PM'
  const hour = dt.hour % 12 === 0 ? 12 : dt.hour % 12
  const minute = String(dt.minute).padStart(2, '0')
  return `${hour}:${minute} ${suffix}`
}

export function formatDateTime(iso: string): string {
  const dt = DateTime.fromISO(iso, { setZone: true }).setZone(ZONE)
  return `${dt.toFormat('dd/MM/yyyy')} ${formatTime(iso)}`
}

export function formatOperationalDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

/** El día operativo vigente a las 6:00. A las 5:59 sigue siendo el día anterior. */
export function currentOperationalDate(now: Date): string {
  const local = DateTime.fromJSDate(now, { zone: ZONE })
  const opening = local.set({ hour: 6, minute: 0, second: 0, millisecond: 0 })
  const day = local < opening ? local.minus({ days: 1 }) : local
  return day.toISODate() ?? opening.toISODate()!
}

export function diffMinutes(laterIso: string, earlierIso: string): number {
  return Math.round((Date.parse(laterIso) - Date.parse(earlierIso)) / 60000)
}

export function minutesUntil(iso: string, now: Date): number {
  return Math.floor((Date.parse(iso) - now.getTime()) / 60000)
}
