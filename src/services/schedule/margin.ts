import type { Session, Settings } from '../../types'
import { diffMinutes } from '../../utils/time'

export type MarginBand = 'ajustado' | 'justo' | 'holgado'

export type MarginInfo = {
  nextStart: string | null
  minutes: number | null
  adjustedMinutes: number | null
  overlap: boolean
  band: MarginBand | null
}

/**
 * La siguiente función es la de menor Start posterior al Start actual, en la misma sala.
 * El margen es ese Start menos el Finish actual. Si el resultado es negativo, hay cruce.
 */
export function marginFor(
  session: Session,
  sessions: Session[],
  settings: Pick<Settings, 'safetyMargin' | 'tightBelow' | 'comfortableUntil'>,
): MarginInfo {
  const next = sessions
    .filter((other) => other.screen === session.screen && other.id !== session.id && other.start > session.start)
    .sort((a, b) => a.start.localeCompare(b.start))[0]
  if (!next) {
    return { nextStart: null, minutes: null, adjustedMinutes: null, overlap: false, band: null }
  }
  const minutes = diffMinutes(next.start, session.finish)
  const overlap = minutes < 0
  const adjustedMinutes = overlap ? minutes : minutes - settings.safetyMargin
  return {
    nextStart: next.start,
    minutes,
    adjustedMinutes,
    overlap,
    band: overlap ? null : bandFor(adjustedMinutes, settings),
  }
}

export function bandFor(
  minutes: number,
  settings: Pick<Settings, 'tightBelow' | 'comfortableUntil'>,
): MarginBand {
  if (minutes < settings.tightBelow) return 'ajustado'
  if (minutes <= settings.comfortableUntil) return 'justo'
  return 'holgado'
}

export function shortestMargin(infos: MarginInfo[]): { minutes: number; index: number } | null {
  let best: { minutes: number; index: number } | null = null
  infos.forEach((info, index) => {
    if (info.adjustedMinutes == null) return
    if (!best || info.adjustedMinutes < best.minutes) best = { minutes: info.adjustedMinutes, index }
  })
  return best
}
