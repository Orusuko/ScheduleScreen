import type { RawItem, RawPage } from '../src/services/pdf/reconstruct'
import { sessionId, type Session } from '../src/types'

export function item(text: string, x: number, y: number, width = Math.max(24, text.length * 5)): RawItem {
  return { text, x, y, width }
}

const X = {
  finish: 56,
  cleanup: 120,
  start: 190,
  feature: 250,
  screen: 320,
  title: 420,
  private: 590,
  seats: 660,
  censor: 740,
}

export function headers(y = 500): RawItem[] {
  return [
    item('Finish', X.finish, y, 26),
    item('Cleanup', X.cleanup, y, 40),
    item('Complete', X.cleanup, y - 12, 48),
    item('Start', X.start, y, 24),
    item('Feature', X.feature, y, 36),
    item('Screen', X.screen, y, 32),
    item('Film Title', X.title, y, 50),
    item('Private', X.private, y, 36),
    item('Screening', X.private, y - 12, 48),
    item('Seat Allocation', X.seats, y, 70),
    item('Censor', X.censor, y, 32),
  ]
}

export type RowInput = {
  finish: string
  cleanup?: string
  start: string
  feature: string
  screen: string
  title: string
  seats?: string
  censor: string
  y: number
  x?: Partial<typeof X>
}

export function sessionRow(row: RowInput): RawItem[] {
  const x = { ...X, ...row.x }
  return [
    item(row.finish, x.finish, row.y),
    item(row.cleanup ?? row.finish, x.cleanup, row.y),
    item(row.start, x.start, row.y),
    item(row.feature, x.feature, row.y),
    item(row.screen, x.screen, row.y),
    item(row.title, x.title, row.y, Math.max(80, row.title.length * 5)),
    item(row.seats ?? 'Yes', x.seats, row.y, 20),
    item(row.censor, x.censor, row.y, 16),
  ]
}

export function reportPage(options: {
  page?: string
  title?: string
  from?: string
  until?: string
  date?: string | null
  generated?: boolean
  rows?: RawItem[]
  headers?: RawItem[]
}): RawPage {
  const items: RawItem[] = [
    item(options.title ?? 'Session by Finish Time', 330, 560, 150),
    item(options.from ?? 'From 18/11/2026 06:00 AM', 36, 530, 160),
    item(options.until ?? 'Until 19/11/2026 06:00 AM', 210, 530, 170),
    ...(options.headers ?? headers()),
  ]
  if (options.date !== null) items.push(item(options.date ?? '11/18/2026', 48, 470, 55))
  items.push(...(options.rows ?? []))
  if (options.generated !== false) {
    items.push(item('11/18/2026', 690, 42, 55), item('12:28:41PM', 750, 42, 60))
  }
  items.push(item(options.page ?? '1 / 1', 750, 30, 28))
  return { items }
}

export function makeSession(partial: Pick<Session, 'screen' | 'start' | 'finish' | 'title'> & Partial<Session>): Session {
  const operationalDate = partial.id?.split('|')[0] ?? partial.start.slice(0, 10)
  const start = partial.start
  return {
    id: partial.id ?? sessionId(operationalDate, partial.screen, start),
    start,
    feature: partial.feature ?? start,
    finish: partial.finish,
    cleanupComplete: partial.cleanupComplete ?? partial.finish,
    screen: partial.screen,
    title: partial.title,
    language: partial.language ?? 'Esp',
    format: partial.format ?? '2D',
    censor: partial.censor ?? 'A',
    seatAllocation: partial.seatAllocation ?? 'Yes',
    privateScreening: partial.privateScreening ?? null,
    clean: partial.clean ?? false,
    cleanedAt: partial.cleanedAt ?? null,
  }
}
