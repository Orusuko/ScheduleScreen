import type { SessionView } from './home'
import { diffMinutes, formatTime } from '../../utils/time'

export function leadText(ms: number): string {
  if (ms < 60_000) return 'menos de 1 min'
  return `${Math.floor(ms / 60_000)} min`
}

export function statusText(view: SessionView, now: Date): string {
  const { session, margin } = view
  if (session.clean) {
    if (!session.cleanedAt) return 'Limpia ✓'
    const when = formatTime(session.cleanedAt)
    if (!margin.nextStart) return `Limpia a las ${when}`
    const delta = diffMinutes(margin.nextStart, session.cleanedAt)
    if (delta > 0) return `Limpia a las ${when} · ${delta} min antes`
    if (delta < 0) return `Limpia a las ${when} · ${Math.abs(delta)} min tarde`
    return `Limpia a las ${when}`
  }
  const finishMs = Date.parse(session.finish)
  const nowMs = now.getTime()
  if (finishMs > nowMs) return `Sale en ${leadText(finishMs - nowMs)}`
  if (margin.nextStart && Date.parse(margin.nextStart) <= nowMs) return 'Ya inició la siguiente función'
  if (margin.nextStart) {
    return `Faltan ${leadText(Date.parse(margin.nextStart) - nowMs)} para la siguiente función (${formatTime(margin.nextStart)})`
  }
  return 'Última función de la sala en este reporte'
}

export function marginText(view: SessionView, now: Date): string | null {
  const { margin, session } = view
  if (session.clean || Date.parse(session.finish) <= now.getTime()) return null
  if (margin.overlap) return 'La siguiente función empieza antes de que termine esta'
  if (margin.adjustedMinutes == null) return 'Última función de la sala en este reporte'
  const band = margin.band === 'ajustado' ? 'Ajustado' : margin.band === 'justo' ? 'Justo' : 'Holgado'
  const next = margin.nextStart ? ` · siguiente ${formatTime(margin.nextStart)}` : ''
  return `Margen ${margin.adjustedMinutes} min · ${band}${next}`
}

export function groupHeading(finish: string, count: number, shortest: number | null, screen: number | null): string {
  const time = formatTime(finish)
  const salas = count === 1 ? '1 sala' : `${count} salas`
  if (shortest == null || screen == null) return `${time} · ${salas} · sin siguiente función`
  if (shortest < 0) return `${time} · ${salas} · cruce de horario (Sala ${screen})`
  return `${time} · ${salas} · margen más corto ${shortest} min (Sala ${screen})`
}

export function durationMinutes(startIso: string, endIso: string): number {
  return diffMinutes(endIso, startIso)
}
