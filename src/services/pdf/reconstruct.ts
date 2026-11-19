import type { ParsedReport, Session } from '../../types'
import { sessionId } from '../../types'
import { atCivilTime, atOperationalTime, parseClock, parseDmy, parseMdy } from '../../utils/time'
import { ImportError } from './errors'
import { splitTitle } from './title'

export type RawItem = { text: string; x: number; y: number; width: number }
export type RawPage = { items: RawItem[] }

type ColumnKey = 'finish' | 'cleanup' | 'start' | 'feature' | 'screen' | 'title' | 'private' | 'seats' | 'censor'

const HEADER_TEXT: Record<string, ColumnKey> = {
  finish: 'finish',
  cleanup: 'cleanup',
  complete: 'cleanup',
  start: 'start',
  feature: 'feature',
  screen: 'screen',
  'film title': 'title',
  private: 'private',
  screening: 'private',
  'seat allocation': 'seats',
  censor: 'censor',
}

const COLUMN_LABEL: Record<ColumnKey, string> = {
  finish: 'Finish',
  cleanup: 'Cleanup Complete',
  start: 'Start',
  feature: 'Feature',
  screen: 'Screen',
  title: 'Film Title',
  private: 'Private Screening',
  seats: 'Seat Allocation',
  censor: 'Censor',
}

const REQUIRED: ColumnKey[] = [
  'finish',
  'cleanup',
  'start',
  'feature',
  'screen',
  'title',
  'private',
  'seats',
  'censor',
]

type Column = { key: ColumnKey; left: number; right: number }
type Line = { y: number; items: RawItem[] }

type Draft = {
  operationalDate: string
  finish: string
  cleanup: string
  start: string
  feature: string
  screen: number
  titleRaw: string
  seats: string
  censor: string
  privateScreening: string | null
}

/**
 * Reconstruye el reporte por coordenadas.
 * Las columnas salen del texto y la posición de los encabezados, no de una X fija:
 * en el PDF real las horas van alineadas a la derecha y «Film Title» está centrado
 * sobre títulos que empiezan más a la izquierda.
 */
export function reconstruct(pages: RawPage[]): ParsedReport {
  const numbered = pages.map((page) => ({ page, pageNumber: pageNumberOf(page) }))
  if (numbered.some((entry) => entry.pageNumber == null)) {
    throw new ImportError('missing-page-number', 'No se encontró el número de página en el pie del reporte.')
  }
  const numbers = numbered.map((entry) => entry.pageNumber as number)
  const max = Math.max(...numbers)
  if (new Set(numbers).size !== numbers.length || numbers.some((n) => n < 1 || n > max)) {
    throw new ImportError('missing-page-number', 'La numeración de páginas del reporte está repetida o es inválida.')
  }
  for (let n = 1; n <= max; n += 1) {
    if (!numbers.includes(n)) {
      throw new ImportError('missing-page', `Faltan páginas del reporte: no está la página ${n} de ${max}.`)
    }
  }

  let reportType: ParsedReport['reportType'] | null = null
  let range: { startDate: string; rangeStart: string; rangeEnd: string } | null = null
  let generatedAt: string | null = null
  let operationalDate: string | null = null
  const sessions: Session[] = []

  for (const entry of [...numbered].sort((a, b) => (a.pageNumber as number) - (b.pageNumber as number))) {
    const pageNo = entry.pageNumber as number
    const parsed = readPage(entry.page, pageNo)
    if (parsed.reportType) {
      if (reportType && reportType !== parsed.reportType) {
        throw new ImportError('unsupported-report', 'El PDF mezcla Session by Finish Time y Session by Start Time.')
      }
      reportType = parsed.reportType
    }
    if (parsed.range) {
      if (range && (range.rangeStart !== parsed.range.rangeStart || range.rangeEnd !== parsed.range.rangeEnd)) {
        throw new ImportError('date-mismatch', 'El rango de fechas no coincide entre las páginas del reporte.')
      }
      range = parsed.range
    }
    if (parsed.generatedAt) {
      if (generatedAt && generatedAt !== parsed.generatedAt) {
        throw new ImportError('date-mismatch', 'La hora de generación no coincide entre las páginas del reporte.')
      }
      generatedAt = parsed.generatedAt
    }
    if (!range) {
      throw new ImportError('missing-range', 'No se encontró el rango From / Until del reporte.')
    }
    const built = rowsToSessions(parsed.lines, parsed.columns, pageNo, range.startDate, operationalDate)
    operationalDate = built.operationalDate
    sessions.push(...built.sessions)
  }

  if (!reportType) {
    throw new ImportError(
      'unsupported-report',
      'El PDF no es un reporte «Session by Finish Time» ni «Session by Start Time».',
    )
  }
  if (!range) throw new ImportError('missing-range', 'No se encontró el rango From / Until del reporte.')
  if (!generatedAt) {
    throw new ImportError('missing-generated', 'No se encontró la hora de generación en el pie de página.')
  }
  if (!operationalDate) {
    throw new ImportError('missing-operational-date', 'No se encontró la fecha operativa del día.')
  }
  if (sessions.length === 0) {
    throw new ImportError('no-sessions', 'El reporte no contiene funciones.')
  }

  const seen = new Set<string>()
  for (const session of sessions) {
    if (seen.has(session.id)) {
      throw new ImportError(
        'duplicate-row',
        `La sala ${session.screen} aparece dos veces con el mismo horario de entrada.`,
      )
    }
    seen.add(session.id)
  }

  return {
    reportType,
    operationalDate,
    rangeStart: range.rangeStart,
    rangeEnd: range.rangeEnd,
    generatedAt,
    sessions,
  }
}

function readPage(page: RawPage, pageNo: number) {
  const pageNumberItem = page.items.find((item) => /^\d+\s*\/\s*\d+$/.test(item.text.trim()))
  if (!pageNumberItem) {
    throw new ImportError('missing-page-number', `La página ${pageNo} no trae el número de página.`)
  }
  const footerCeiling = pageNumberItem.y + 16
  const content = page.items.filter((item) => item.y > footerCeiling)
  const reportType = reportTypeOf(content)
  const range = rangeOf(content)
  const generatedAt = generatedAtOf(page.items.filter((item) => item.y <= footerCeiling))
  const columns = columnsOf(content, pageNo)
  const headerBottom = Math.min(...columns.headerItems.map((item) => item.y))
  const headerIds = new Set(columns.headerItems)
  const body = content.filter((item) => item.y < headerBottom - 1 && !headerIds.has(item))
  return { reportType, range, generatedAt, columns: columns.columns, lines: clusterLines(body) }
}

function pageNumberOf(page: RawPage): number | null {
  const item = page.items.find((entry) => /^\d+\s*\/\s*\d+$/.test(entry.text.trim()))
  if (!item) return null
  return Number(item.text.trim().split('/')[0])
}

function reportTypeOf(items: RawItem[]): ParsedReport['reportType'] | null {
  const text = items.map((item) => item.text).join(' ').toLowerCase()
  const finish = text.includes('session by finish time')
  const start = text.includes('session by start time')
  if (finish && start) return null
  if (finish) return 'finish-time'
  if (start) return 'start-time'
  return null
}

function rangeOf(items: RawItem[]): { startDate: string; rangeStart: string; rangeEnd: string } | null {
  for (const line of clusterLines(items)) {
    const text = joinText(line.items)
    const match = text.match(
      /From\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\s+Until\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i,
    )
    if (!match) continue
    const startDate = parseDmy(match[1])
    const endDate = parseDmy(match[3])
    const startClock = parseClock(match[2])
    const endClock = parseClock(match[4])
    if (!startDate || !endDate || !startClock || !endClock) {
      throw new ImportError('invalid-time', `No se pudo leer el rango «${text}».`)
    }
    return {
      startDate,
      rangeStart: atCivilTime(startDate, startClock),
      rangeEnd: atCivilTime(endDate, endClock),
    }
  }
  return null
}

function generatedAtOf(items: RawItem[]): string | null {
  const lines = clusterLines(items)
  for (const line of lines) {
    const combined = joinText(line.items)
    const together = combined.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))/i)
    if (together) {
      const date = parseMdy(together[1])
      const clock = parseClock(together[2])
      if (date && clock) return atCivilTime(date, clock)
    }
    const dateItem = [...line.items].reverse().find((item) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(item.text.trim()))
    const timeItem = line.items.find((item) => /^\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)$/i.test(item.text.trim()))
    if (dateItem && timeItem && timeItem.x > dateItem.x) {
      const date = parseMdy(dateItem.text)
      const clock = parseClock(timeItem.text)
      if (!date || !clock) return null
      // El pie es la hora civil en que Vista generó el archivo, no una función.
      return atCivilTime(date, clock)
    }
  }
  return null
}

function columnsOf(items: RawItem[], pageNo: number): { columns: Column[]; headerItems: RawItem[] } {
  const candidates = items.filter((item) => HEADER_TEXT[normalize(item.text)])
  if (candidates.length === 0) {
    throw new ImportError('missing-columns', `Página ${pageNo}: no se encontraron los encabezados de columna.`)
  }
  const anchor = Math.max(...candidates.map((item) => item.y))
  const headerItems = candidates.filter((item) => item.y <= anchor + 4 && item.y >= anchor - 18)
  const boxes = new Map<ColumnKey, { x0: number; x1: number }>()
  for (const item of headerItems) {
    const key = HEADER_TEXT[normalize(item.text)]
    const box = boxes.get(key) ?? { x0: Number.POSITIVE_INFINITY, x1: Number.NEGATIVE_INFINITY }
    box.x0 = Math.min(box.x0, item.x)
    box.x1 = Math.max(box.x1, item.x + item.width)
    boxes.set(key, box)
  }
  const missing = REQUIRED.filter((key) => !boxes.has(key))
  if (missing.length > 0) {
    throw new ImportError(
      'missing-columns',
      `Página ${pageNo}: faltan columnas (${missing.map((key) => COLUMN_LABEL[key]).join(', ')}).`,
    )
  }
  const ordered = REQUIRED.map((key) => {
    const box = boxes.get(key)!
    return { key, center: (box.x0 + box.x1) / 2 }
  }).sort((a, b) => a.center - b.center)
  const columns = ordered.map((column, index) => ({
    key: column.key,
    left: index === 0 ? Number.NEGATIVE_INFINITY : (ordered[index - 1].center + column.center) / 2,
    right: index === ordered.length - 1 ? Number.POSITIVE_INFINITY : (column.center + ordered[index + 1].center) / 2,
  }))
  return { columns, headerItems }
}

function rowsToSessions(
  lines: Line[],
  columns: Column[],
  pageNo: number,
  rangeStartDate: string,
  inheritedDate: string | null,
): { sessions: Session[]; operationalDate: string | null } {
  let operationalDate = inheritedDate
  let draft: Draft | null = null
  const sessions: Session[] = []

  const flush = () => {
    if (!draft) return
    const split = splitTitle(draft.titleRaw)
    if (!split) {
      throw new ImportError(
        'incomplete-row',
        `Página ${pageNo}: no se pudo separar título, idioma y formato en «${draft.titleRaw}».`,
      )
    }
    const start = stamp(draft.operationalDate, draft.start, 'Start', pageNo)
    const feature = stamp(draft.operationalDate, draft.feature, 'Feature', pageNo)
    const finish = stamp(draft.operationalDate, draft.finish, 'Finish', pageNo)
    const cleanup = stamp(draft.operationalDate, draft.cleanup, 'Cleanup Complete', pageNo)
    if (Date.parse(finish) < Date.parse(start)) {
      throw new ImportError(
        'invalid-time',
        `Página ${pageNo}: la sala ${draft.screen} termina antes de la hora de entrada.`,
      )
    }
    sessions.push({
      id: sessionId(draft.operationalDate, draft.screen, start),
      start,
      feature,
      finish,
      cleanupComplete: cleanup,
      screen: draft.screen,
      title: split.title,
      language: split.language,
      format: split.format,
      censor: draft.censor,
      seatAllocation: draft.seats,
      privateScreening: draft.privateScreening,
      clean: false,
      cleanedAt: null,
    })
    draft = null
  }

  for (const line of lines) {
    const cells = cellsOf(line.items, columns)
    const joined = joinText(line.items).trim()
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(joined)) {
      flush()
      const date = parseMdy(joined)
      if (!date) throw new ImportError('date-mismatch', `Página ${pageNo}: la fecha «${joined}» no es válida.`)
      if (date !== rangeStartDate) {
        throw new ImportError(
          'date-mismatch',
          `La fecha del encabezado y la fila «${joined}» no son el mismo día.`,
        )
      }
      operationalDate = date
      continue
    }
    const filled = (Object.keys(cells) as ColumnKey[]).filter((key) => cells[key])
    if (filled.length === 0) continue
    if (filled.length === 1 && filled[0] === 'title') {
      if (!draft) {
        throw new ImportError('incomplete-row', `Página ${pageNo}: hay un título suelto («${cells.title}»).`)
      }
      draft.titleRaw = `${draft.titleRaw} ${cells.title}`
      continue
    }
    const required: ColumnKey[] = ['finish', 'start', 'feature', 'screen', 'title', 'seats', 'censor', 'cleanup']
    const absent = required.filter((key) => !cells[key])
    if (absent.length > 0) {
      throw new ImportError(
        'incomplete-row',
        `Página ${pageNo}: hay una fila incompleta (${absent.map((key) => COLUMN_LABEL[key]).join(', ')}).`,
      )
    }
    if (!operationalDate) {
      throw new ImportError('missing-operational-date', `Página ${pageNo}: hay funciones antes de la fecha operativa.`)
    }
    const screen = parseScreen(cells.screen, pageNo)
    const censor = cells.censor.trim()
    if (!/^[A-Za-z0-9-]+$/.test(censor)) {
      throw new ImportError('invalid-time', `Página ${pageNo}: la clasificación «${censor}» no es válida.`)
    }
    flush()
    draft = {
      operationalDate,
      finish: cells.finish,
      cleanup: cells.cleanup,
      start: cells.start,
      feature: cells.feature,
      screen,
      titleRaw: cells.title,
      seats: cells.seats.trim(),
      censor,
      privateScreening: cells.private ? cells.private.trim() : null,
    }
  }
  flush()
  return { sessions, operationalDate }
}

function stamp(operationalDate: string, raw: string, label: string, pageNo: number): string {
  const clock = parseClock(raw)
  if (!clock) {
    throw new ImportError('invalid-time', `Página ${pageNo}: hora no válida en ${label} («${raw}»).`)
  }
  return atOperationalTime(operationalDate, clock)
}

function parseScreen(raw: string, pageNo: number): number {
  const match = raw.trim().match(/^SALA\s+(\d+)$/i)
  if (!match || Number(match[1]) < 1) {
    throw new ImportError('invalid-screen', `Página ${pageNo}: sala no válida («${raw}»).`)
  }
  return Number(match[1])
}

function cellsOf(items: RawItem[], columns: Column[]): Record<ColumnKey, string> {
  const grouped = new Map<ColumnKey, RawItem[]>()
  for (const item of items) {
    const center = item.x + item.width / 2
    const column = columns.find((entry) => center >= entry.left && center < entry.right)
    if (!column) continue
    const list = grouped.get(column.key) ?? []
    list.push(item)
    grouped.set(column.key, list)
  }
  const cells = {} as Record<ColumnKey, string>
  for (const key of REQUIRED) cells[key] = ''
  for (const [key, list] of grouped) cells[key] = joinText(list).trim()
  return cells
}

function clusterLines(items: RawItem[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: Line[] = []
  for (const item of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - item.y) <= 2) last.items.push(item)
    else lines.push({ y: item.y, items: [item] })
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x)
  return lines
}

function joinText(items: RawItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x)
  let text = ''
  let cursor = -Infinity
  for (const item of sorted) {
    const gap = item.x - cursor
    text += gap > 1.5 && text ? ` ${item.text}` : item.text
    cursor = item.x + item.width
  }
  return text.replace(/\s+/g, ' ').trim()
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}
