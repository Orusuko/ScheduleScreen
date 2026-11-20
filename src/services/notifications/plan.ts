import type { AppData, OperationalDay, Session } from '../../types'
import { marginFor } from '../schedule/margin'
import { DateTime } from 'luxon'

export type PlannedAlert = {
  id: number
  at: string
  title: string
  body: string
}

/** Un aviso por hora de salida. Si la sala ya está limpia, no entra al grupo. */
export function planNotifications(data: AppData, now: Date): PlannedAlert[] {
  if (!data.settings.notificationsEnabled) return []
  const alerts: PlannedAlert[] = []
  for (const day of data.days) alerts.push(...planDay(day, data, now))
  return alerts
}

function planDay(day: OperationalDay, data: AppData, now: Date): PlannedAlert[] {
  const lead = data.settings.leadMinutes
  const groups = new Map<string, Session[]>()
  for (const session of day.sessions) {
    if (session.clean) continue
    const list = groups.get(session.finish) ?? []
    list.push(session)
    groups.set(session.finish, list)
  }
  const alerts: PlannedAlert[] = []
  for (const [finish, sessions] of groups) {
    const at = DateTime.fromISO(finish, { setZone: true }).minus({ minutes: lead })
    if (at.toMillis() <= now.getTime()) continue
    const ordered = [...sessions].sort((a, b) => a.screen - b.screen)
    const margins = ordered.map((session) => ({
      session,
      margin: marginFor(session, day.sessions, data.settings),
    }))
    const ranked = margins
      .filter((entry) => entry.margin.adjustedMinutes != null && !entry.margin.overlap)
      .sort((a, b) => a.margin.adjustedMinutes! - b.margin.adjustedMinutes!)
    const iso = at.toISO({ suppressMilliseconds: true })
    if (!iso) continue
    if (ordered.length === 1) {
      const only = margins[0]
      alerts.push({
        id: alertId(day.operationalDate, finish),
        at: iso,
        title: individualTitle(only.session.screen, lead, only.margin),
        body: only.session.title,
      })
    } else {
      const shortest = ranked[0]
      const title = shortest
        ? `${ordered.length} salas salen en ${lead} min · margen más corto ${shortest.margin.adjustedMinutes} min (Sala ${shortest.session.screen})`
        : `${ordered.length} salas salen en ${lead} min · sin siguiente función en el reporte`
      alerts.push({
        id: alertId(day.operationalDate, finish),
        at: iso,
        title,
        body: ordered.map((session) => `Sala ${session.screen} · ${session.title}`).join('\n'),
      })
    }
  }
  return alerts
}

function individualTitle(
  screen: number,
  lead: number,
  margin: { adjustedMinutes: number | null; overlap: boolean },
): string {
  if (margin.overlap) return `Sala ${screen} sale en ${lead} min · la siguiente ya se empalma`
  if (margin.adjustedMinutes == null) return `Sala ${screen} sale en ${lead} min · última función de la sala`
  return `Sala ${screen} sale en ${lead} min · margen de limpieza ${margin.adjustedMinutes} min`
}

export function alertId(operationalDate: string, finishIso: string): number {
  const text = `${operationalDate}|${finishIso}`
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const id = (hash >>> 0) % 2_000_000_000
  return id === 0 ? 1 : id
}
