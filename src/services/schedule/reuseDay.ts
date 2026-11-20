import { DateTime } from 'luxon'
import { sessionId, type ParsedReport, type Session } from '../../types'
import { ZONE } from '../../utils/time'

/**
 * El cine reutiliza el mismo PDF varios días. Se recorre la fecha operativa
 * y cada hora de función conserva su reloj (la de las 2:55 PM sigue a las 2:55 PM).
 * La medianoche sigue cayendo en el día civil siguiente al nuevo día operativo.
 */
export function shiftReportToOperationalDate(report: ParsedReport, targetDate: string): ParsedReport {
  if (report.operationalDate === targetDate) return report
  const from = DateTime.fromISO(report.operationalDate, { zone: ZONE }).startOf('day')
  const to = DateTime.fromISO(targetDate, { zone: ZONE }).startOf('day')
  if (!from.isValid || !to.isValid) throw new Error('Fecha operativa inválida')
  const days = Math.round(to.diff(from, 'days').days)
  const shift = (iso: string) => {
    const moved = DateTime.fromISO(iso, { setZone: true }).setZone(ZONE).plus({ days })
    const next = moved.toISO({ suppressMilliseconds: true })
    if (!next) throw new Error('No se pudo mover la fecha')
    return next
  }
  return {
    ...report,
    operationalDate: targetDate,
    rangeStart: shift(report.rangeStart),
    rangeEnd: shift(report.rangeEnd),
    generatedAt: shift(report.generatedAt),
    sessions: report.sessions.map((session) => shiftSession(session, targetDate, shift)),
  }
}

function shiftSession(session: Session, operationalDate: string, shift: (iso: string) => string): Session {
  const start = shift(session.start)
  return {
    ...session,
    id: sessionId(operationalDate, session.screen, start),
    start,
    feature: shift(session.feature),
    finish: shift(session.finish),
    cleanupComplete: shift(session.cleanupComplete),
  }
}
