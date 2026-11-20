import { describe, expect, it } from 'vitest'
import { planReimport, retainDays } from '../src/services/storage/reimport'
import { Repository, MemoryFiles, DATA_FILE, BAK_FILE } from '../src/services/storage/repository'
import { defaultAppData, type OperationalDay } from '../src/types'
import { makeSession } from './support'

const generatedAt = '2026-11-18T16:00:00-06:00'

describe('reimportación', () => {
  const early = makeSession({
    screen: 10,
    title: 'La Venganza Del Charro Negro',
    start: '2026-11-18T13:10:00-06:00',
    finish: '2026-11-18T14:55:00-06:00',
    clean: true,
    cleanedAt: '2026-11-18T15:00:00-06:00',
  })
  const later = makeSession({
    screen: 10,
    title: 'Atrápelo Quien Pueda',
    start: '2026-11-18T19:50:00-06:00',
    finish: '2026-11-18T21:37:00-06:00',
  })

  it('no duplica y conserva la marca al importar el mismo reporte', () => {
    const plan = planReimport([early, later], [early, later], generatedAt)
    expect(plan.added).toHaveLength(0)
    expect(plan.disappearedFuture).toHaveLength(0)
    expect(plan.keeping.find((session) => session.id === early.id)?.clean).toBe(true)
    expect(plan.keeping).toHaveLength(2)
  })

  it('conserva sola la función que ya había terminado y pregunta por la futura', () => {
    const plan = planReimport([early, later], [early], generatedAt)
    expect(plan.keptPast).toHaveLength(0)
    expect(plan.disappearedFuture.map((session) => session.id)).toEqual([later.id])
    const pastOnly = planReimport([early], [], generatedAt)
    expect(pastOnly.keptPast.map((session) => session.id)).toEqual([early.id])
    expect(pastOnly.disappearedFuture).toHaveLength(0)
    expect(pastOnly.dropping.map((session) => session.id)).toEqual([early.id])
  })

  it('si solo cambió el inicio, conserva la limpia de esa película y sala', () => {
    const moved = { ...later, start: '2026-11-18T20:10:00-06:00', id: '2026-11-18|10|2026-11-18T20:10:00-06:00' }
    const marked = { ...later, clean: true, cleanedAt: '2026-11-18T19:00:00-06:00' }
    const plan = planReimport([marked], [moved], generatedAt)
    expect(plan.updated[0].clean).toBe(true)
    expect(plan.updated[0].id).toBe(moved.id)
    expect(plan.disappearedFuture).toHaveLength(0)
  })

  it('no transfiere la marca si hay dos funciones iguales en la misma sala', () => {
    const first = makeSession({
      screen: 2,
      title: 'Ebenezer: Los Fantasmas De Navidad',
      start: '2026-11-18T13:40:00-06:00',
      finish: '2026-11-18T15:56:00-06:00',
      clean: true,
      cleanedAt: '2026-11-18T15:00:00-06:00',
    })
    const second = makeSession({
      screen: 2,
      title: 'Ebenezer: Los Fantasmas De Navidad',
      start: '2026-11-18T16:15:00-06:00',
      finish: '2026-11-18T18:31:00-06:00',
    })
    const movedFirst = { ...first, start: '2026-11-18T13:50:00-06:00', id: '2026-11-18|2|2026-11-18T13:50:00-06:00', clean: false, cleanedAt: null }
    const movedSecond = { ...second, start: '2026-11-18T16:40:00-06:00', id: '2026-11-18|2|2026-11-18T16:40:00-06:00' }
    const plan = planReimport([first, second], [movedFirst, movedSecond], '2026-11-18T12:00:00-06:00')
    expect(plan.added).toHaveLength(2)
    expect(plan.added.every((session) => session.clean === false)).toBe(true)
    expect(plan.disappearedFuture).toHaveLength(2)
  })

  it('guarda tres días y recupera el respaldo si el archivo vigente se daña', async () => {
    const files = new MemoryFiles()
    const repo = new Repository(files)
    const day = (operationalDate: string): OperationalDay => ({
      operationalDate,
      reportType: 'finish-time',
      rangeStart: `${operationalDate}T06:00:00-06:00`,
      rangeEnd: `${operationalDate}T06:00:00-06:00`,
      generatedAt: `${operationalDate}T12:00:00-06:00`,
      importedAt: `${operationalDate}T12:01:00-06:00`,
      sessions: [],
    })
    const data = defaultAppData()
    data.days = [day('2026-11-15'), day('2026-11-16'), day('2026-11-17'), day('2026-11-18')]
    await repo.save(data)
    await repo.save(data)
    const loaded = await repo.load()
    expect(loaded.days.map((entry) => entry.operationalDate)).toEqual(['2026-11-18', '2026-11-17', '2026-11-16'])
    files.files.set(DATA_FILE, '{roto')
    const restored = await repo.load()
    expect(restored.days).toHaveLength(3)
    expect(files.files.get(BAK_FILE)).toBeTruthy()
  })

  it('retainDays deja los tres más recientes', () => {
    const days = ['2026-11-01', '2026-11-04', '2026-11-02', '2026-11-03'].map((operationalDate) => ({
      operationalDate,
      reportType: 'finish-time' as const,
      rangeStart: '',
      rangeEnd: '',
      generatedAt: '',
      importedAt: '',
      sessions: [],
    }))
    expect(retainDays(days).map((day) => day.operationalDate)).toEqual(['2026-11-04', '2026-11-03', '2026-11-02'])
  })
})
