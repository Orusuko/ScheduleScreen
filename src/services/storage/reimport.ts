import type { OperationalDay, ParsedReport, Session } from '../../types'

export type ReimportPlan = {
  /** Resultado si se conservan las funciones futuras que ya no vienen. */
  keeping: Session[]
  /** Resultado si el usuario acepta quitarlas. */
  dropping: Session[]
  added: Session[]
  updated: Session[]
  keptPast: Session[]
  disappearedFuture: Session[]
}

/** Quita acentos para emparejar la misma película si Vista solo movió la hora. */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function sameFilm(a: Session, b: Session): boolean {
  return a.screen === b.screen && normalizeTitle(a.title) === normalizeTitle(b.title)
}

function changed(previous: Session, next: Session): boolean {
  return (
    previous.start !== next.start ||
    previous.feature !== next.feature ||
    previous.finish !== next.finish ||
    previous.cleanupComplete !== next.cleanupComplete ||
    previous.title !== next.title ||
    previous.language !== next.language ||
    previous.format !== next.format ||
    previous.censor !== next.censor ||
    previous.seatAllocation !== next.seatAllocation ||
    previous.privateScreening !== next.privateScreening
  )
}

function withCleanState(next: Session, previous: Session | null): Session {
  if (!previous) return { ...next, clean: false, cleanedAt: null }
  return { ...next, clean: previous.clean, cleanedAt: previous.cleanedAt }
}

/**
 * Actualiza el día sin duplicar. Una salida cuyo Finish es anterior a la hora
 * de generación del reporte nuevo nunca se propone como desaparecida.
 * Si el inicio cambió y solo hay una función con la misma sala y título, se
 * conserva la marca de limpia.
 */
export function planReimport(existing: Session[], imported: Session[], generatedAt: string): ReimportPlan {
  const used = new Set<string>()
  const added: Session[] = []
  const updated: Session[] = []
  const merged: Session[] = []
  const unmatched: Session[] = []

  for (const session of imported) {
    const previous = existing.find((item) => item.id === session.id)
    if (!previous) {
      unmatched.push(session)
      continue
    }
    used.add(previous.id)
    const next = withCleanState(session, previous)
    merged.push(next)
    if (changed(previous, session)) updated.push(next)
  }

  for (const session of unmatched) {
    const candidates = existing.filter((item) => !used.has(item.id) && sameFilm(item, session))
    if (candidates.length === 1) {
      used.add(candidates[0].id)
      const next = withCleanState(session, candidates[0])
      merged.push(next)
      updated.push(next)
    } else {
      const next = withCleanState(session, null)
      merged.push(next)
      added.push(next)
    }
  }

  const keptPast: Session[] = []
  const disappearedFuture: Session[] = []
  const generatedMs = Date.parse(generatedAt)
  for (const previous of existing) {
    if (used.has(previous.id)) continue
    if (Date.parse(previous.finish) < generatedMs) keptPast.push(previous)
    else disappearedFuture.push(previous)
  }

  return {
    keeping: [...merged, ...keptPast, ...disappearedFuture],
    dropping: [...merged, ...keptPast],
    added,
    updated,
    keptPast,
    disappearedFuture,
  }
}

export function dayFromReport(report: ParsedReport, sessions: Session[], importedAt: string): OperationalDay {
  return {
    operationalDate: report.operationalDate,
    reportType: report.reportType,
    rangeStart: report.rangeStart,
    rangeEnd: report.rangeEnd,
    generatedAt: report.generatedAt,
    importedAt,
    sessions,
  }
}

export function retainDays(days: OperationalDay[], max = 3): OperationalDay[] {
  return [...days].sort((a, b) => b.operationalDate.localeCompare(a.operationalDate)).slice(0, max)
}
