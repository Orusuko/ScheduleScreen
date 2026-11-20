import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { extractPdfPages } from '../src/services/pdf/extract'
import { ImportError } from '../src/services/pdf/errors'
import { reconstruct } from '../src/services/pdf/reconstruct'
import { splitTitle } from '../src/services/pdf/title'
import { marginFor } from '../src/services/schedule/margin'
import { DEFAULT_SETTINGS } from '../src/types'
import { headers, reportPage, sessionRow } from './support'

beforeAll(() => {
  GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ).href
})

describe('título', () => {
  it('separa idioma y 3D', () => {
    expect(splitTitle('El Laberinto Del Fauno 3D Esp')).toEqual({
      title: 'El Laberinto Del Fauno',
      language: 'Esp',
      format: '3D',
    })
    expect(splitTitle('Yo Soy Rocky Sub')).toEqual({ title: 'Yo Soy Rocky', language: 'Sub', format: '2D' })
  })
})

describe('reconstrucción sintética', () => {
  const baseRow = {
    finish: '2:55PM',
    start: '1:10PM',
    feature: '1:30PM',
    screen: 'SALA 10',
    title: 'La Venganza Del Charro Negro Esp',
    censor: 'A',
    y: 400,
  }

  it('lee un reporte de una página', () => {
    const report = reconstruct([reportPage({ rows: sessionRow(baseRow) })])
    expect(report.sessions).toHaveLength(1)
    expect(report.operationalDate).toBe('2026-11-18')
    expect(report.sessions[0].screen).toBe(10)
    expect(report.sessions[0].finish).toBe('2026-11-18T14:55:00-06:00')
  })

  it('no depende del orden de las columnas', () => {
    const swapped = {
      finish: 190,
      start: 56,
    }
    const report = reconstruct([
      reportPage({
        title: 'Session by Start Time',
        headers: headers().map((entry) => {
          if (entry.text === 'Finish') return { ...entry, x: swapped.finish }
          if (entry.text === 'Start') return { ...entry, x: swapped.start }
          return entry
        }),
        rows: sessionRow({ ...baseRow, x: swapped }),
      }),
    ])
    expect(report.reportType).toBe('start-time')
    expect(report.sessions[0].start).toBe('2026-11-18T13:10:00-06:00')
    expect(report.sessions[0].finish).toBe('2026-11-18T14:55:00-06:00')
  })

  it('hereda la fecha si la segunda página no la trae y respeta el número de página', () => {
    const page1 = reportPage({
      page: '1 / 2',
      rows: sessionRow({ ...baseRow, y: 400, title: 'Primera Esp' }),
    })
    const page2 = reportPage({
      page: '2 / 2',
      date: null,
      rows: sessionRow({
        ...baseRow,
        y: 400,
        screen: 'SALA 1',
        finish: '0:03AM',
        start: '9:05PM',
        feature: '9:25PM',
        title: 'Los Juegos Del Hambre: Amanecer Sub',
        censor: 'B',
      }),
    })
    const report = reconstruct([page2, page1])
    expect(report.sessions.map((session) => session.title)).toEqual([
      'Primera',
      'Los Juegos Del Hambre: Amanecer',
    ])
    expect(report.sessions[1].finish).toBe('2026-11-19T00:03:00-06:00')
    expect(report.sessions[1].language).toBe('Sub')
  })

  it('acepta 11/12/2026 como 11 de diciembre cuando los dos formatos coinciden', () => {
    const report = reconstruct([
      reportPage({
        from: 'From 11/12/2026 06:00 AM',
        until: 'Until 12/12/2026 06:00 AM',
        date: '12/11/2026',
        rows: sessionRow(baseRow),
      }),
    ])
    expect(report.operationalDate).toBe('2026-12-11')
    expect(report.sessions[0].finish).toBe('2026-12-11T14:55:00-06:00')
  })

  it('rechaza el reporte si el encabezado y la fila de fecha no son el mismo día', () => {
    expect(() =>
      reconstruct([
        reportPage({
          from: 'From 11/12/2026 06:00 AM',
          until: 'Until 12/12/2026 06:00 AM',
          date: '11/12/2026',
          rows: sessionRow(baseRow),
        }),
      ]),
    ).toThrow(ImportError)
  })

  it('pega un título que baja de línea', () => {
    const report = reconstruct([
      reportPage({
        rows: [
          ...sessionRow({ ...baseRow, title: 'El Laberinto Del Fauno 3D', censor: 'B15' }),
          itemOnlyTitle('Esp', 380),
        ],
      }),
    ])
    expect(report.sessions[0]).toMatchObject({
      title: 'El Laberinto Del Fauno',
      format: '3D',
      language: 'Esp',
      censor: 'B15',
    })
  })

  it('rechaza fila incompleta, columnas faltantes y otro formato', () => {
    expect(() =>
      reconstruct([
        reportPage({
          rows: sessionRow(baseRow).filter((entry) => entry.text !== 'A'),
        }),
      ]),
    ).toThrow(/incompleta/)

    expect(() =>
      reconstruct([
        reportPage({
          headers: headers().filter((entry) => entry.text !== 'Censor'),
          rows: sessionRow(baseRow),
        }),
      ]),
    ).toThrow(/faltan columnas/i)

    expect(() => reconstruct([reportPage({ title: 'Reporte de dulcería', rows: sessionRow(baseRow) })])).toThrow(
      /Session by Finish Time/,
    )
  })
})

function itemOnlyTitle(text: string, y: number) {
  return { text, x: 420, y, width: 40 }
}

describe('PDF real de Vista', () => {
  it('obtiene las 31 funciones, la medianoche y los márgenes de referencia', async () => {
    const bytes = new Uint8Array(
      await readFile(path.resolve('fixtures/2026-11-18-session-by-finish-time.pdf')),
    )
    const expected = JSON.parse(
      await readFile(path.resolve('fixtures/2026-11-18-session-by-finish-time.expected.json'), 'utf8'),
    ) as {
      reportType: string
      operationalDate: string
      generatedAt: string
      rangeStart: string
      rangeEnd: string
      sessions: string[][]
    }
    const report = reconstruct(await extractPdfPages(bytes))
    expect(report.reportType).toBe(expected.reportType)
    expect(report.operationalDate).toBe(expected.operationalDate)
    expect(report.generatedAt).toBe(expected.generatedAt)
    expect(report.rangeStart).toBe(expected.rangeStart)
    expect(report.rangeEnd).toBe(expected.rangeEnd)
    expect(report.sessions).toHaveLength(31)
    expect(report.sessions.map(compact)).toEqual(expected.sessions)
    expect(report.sessions.every((session) => session.cleanupComplete === session.finish)).toBe(true)
    expect(report.sessions.every((session) => session.seatAllocation === 'Yes' && session.privateScreening == null)).toBe(
      true,
    )
    expect(new Set(report.sessions.map((session) => session.id)).size).toBe(31)

    const settings = DEFAULT_SETTINGS
    const by = (screen: number, finish: string) =>
      report.sessions.find((session) => session.screen === screen && session.finish.includes(finish))!
    expect(marginFor(by(10, 'T14:55:00'), report.sessions, settings).minutes).toBe(20)
    expect(marginFor(by(2, 'T15:56:00'), report.sessions, settings).minutes).toBe(19)
    expect(marginFor(by(8, 'T16:12:00'), report.sessions, settings).minutes).toBe(18)
    expect(marginFor(by(3, 'T16:42:00'), report.sessions, settings).minutes).toBe(18)
    expect(marginFor(by(7, 'T14:58:00'), report.sessions, settings).minutes).toBe(42)
    expect(marginFor(by(8, 'T20:22:00'), report.sessions, settings).minutes).toBe(98)
    expect(marginFor(by(1, 'T00:03:00'), report.sessions, settings).minutes).toBeNull()
    expect(marginFor(by(3, 'T23:18:00'), report.sessions, settings).minutes).toBeNull()
  })
})

function compact(session: {
  screen: number
  start: string
  feature: string
  finish: string
  title: string
  language: string
  format: string
  censor: string
}): string[] {
  return [
    String(session.screen),
    session.start,
    session.feature,
    session.finish,
    session.title,
    session.language,
    session.format,
    session.censor,
  ]
}
