import type { Session, Settings } from '../../types'
import { marginFor, type MarginInfo } from './margin'

export type Urgency = 'neutral' | 'soon' | 'overdue' | 'critical' | 'clean'

export type SessionView = {
  session: Session
  margin: MarginInfo
  section: 'actuales' | 'pasadas'
  urgency: Urgency
  unmarked: boolean
}

export type GroupView = {
  finish: string
  sessions: SessionView[]
  shortestMargin: number | null
  shortestScreen: number | null
}

const SOON_MINUTES = 20

/** Arma Actuales y Pasadas. Las salidas sin limpiar no se esconden hasta pasar el límite. */
export function buildHome(sessions: Session[], settings: Settings, now: Date): { actuales: GroupView[]; pasadas: GroupView[] } {
  const views = sessions.map((session) => decorate(session, sessions, settings, now))
  const actuales = views.filter((view) => view.section === 'actuales')
  const pasadas = views.filter((view) => view.section === 'pasadas')
  const pending = actuales.filter((view) => !view.session.clean && Date.parse(view.session.finish) <= now.getTime())
  const upcoming = actuales.filter((view) => Date.parse(view.session.finish) > now.getTime())
  pending.sort((a, b) => compareUrgency(a, b, now) || a.session.screen - b.session.screen)
  upcoming.sort((a, b) => compareUpcoming(a, b, settings, now))
  pasadas.sort((a, b) => b.session.finish.localeCompare(a.session.finish) || a.session.screen - b.session.screen)
  return {
    actuales: [...groupInOrder(pending), ...groupInOrder(upcoming)],
    pasadas: groupInOrder(pasadas),
  }
}

function decorate(session: Session, sessions: Session[], settings: Settings, now: Date): SessionView {
  const margin = marginFor(session, sessions, settings)
  const finishMs = Date.parse(session.finish)
  const finished = finishMs <= now.getTime()
  const age = now.getTime() - finishMs
  const tooOld = finished && age > settings.pastAfterMinutes * 60_000
  let section: SessionView['section']
  if (!finished) section = 'actuales'
  else if (session.clean || tooOld) section = 'pasadas'
  else section = 'actuales'
  return {
    session,
    margin,
    section,
    urgency: urgencyOf(session, margin, now),
    unmarked: section === 'pasadas' && !session.clean,
  }
}

function urgencyOf(session: Session, margin: MarginInfo, now: Date): Urgency {
  if (session.clean) return 'clean'
  const finishMs = Date.parse(session.finish)
  if (finishMs <= now.getTime()) {
    if (margin.nextStart && Date.parse(margin.nextStart) <= now.getTime()) return 'critical'
    return 'overdue'
  }
  const minutes = Math.floor((finishMs - now.getTime()) / 60_000)
  return minutes < SOON_MINUTES ? 'soon' : 'neutral'
}

function timeUntilNext(view: SessionView, now: Date): number {
  if (!view.margin.nextStart) return Number.POSITIVE_INFINITY
  return Date.parse(view.margin.nextStart) - now.getTime()
}

function compareUrgency(a: SessionView, b: SessionView, now: Date): number {
  return timeUntilNext(a, now) - timeUntilNext(b, now)
}

function compareUpcoming(a: SessionView, b: SessionView, settings: Settings, now: Date): number {
  const direction = settings.invertUpcoming ? -1 : 1
  if (settings.sortByUrgency) return compareUrgency(a, b, now) * direction || a.session.screen - b.session.screen
  return a.session.finish.localeCompare(b.session.finish) * direction || a.session.screen - b.session.screen
}

function groupInOrder(sorted: SessionView[]): GroupView[] {
  const remaining = [...sorted]
  const groups: GroupView[] = []
  while (remaining.length > 0) {
    const first = remaining.shift()!
    const siblings = [first]
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (remaining[index].session.finish === first.session.finish) {
        siblings.push(remaining.splice(index, 1)[0])
      }
    }
    siblings.sort((a, b) => {
      const left = a.margin.adjustedMinutes ?? Number.POSITIVE_INFINITY
      const right = b.margin.adjustedMinutes ?? Number.POSITIVE_INFINITY
      return left - right || a.session.screen - b.session.screen
    })
    const ranked = siblings.filter((view) => view.margin.adjustedMinutes != null)
    ranked.sort((a, b) => a.margin.adjustedMinutes! - b.margin.adjustedMinutes!)
    groups.push({
      finish: first.session.finish,
      sessions: siblings,
      shortestMargin: ranked[0]?.margin.adjustedMinutes ?? null,
      shortestScreen: ranked[0]?.session.screen ?? null,
    })
  }
  return groups
}
