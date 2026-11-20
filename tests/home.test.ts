import { describe, expect, it } from 'vitest'
import { buildHome } from '../src/services/schedule/home'
import { marginText, statusText } from '../src/services/schedule/format'
import { DEFAULT_SETTINGS, type Settings } from '../src/types'
import { makeSession } from './support'

const settings: Settings = { ...DEFAULT_SETTINGS }

function at(iso: string): Date {
  return new Date(iso)
}

describe('lista y margen', () => {
  const sessions = [
    makeSession({
      screen: 10,
      title: 'La Venganza Del Charro Negro',
      start: '2026-11-18T13:10:00-06:00',
      finish: '2026-11-18T14:55:00-06:00',
      feature: '2026-11-18T13:30:00-06:00',
    }),
    makeSession({
      screen: 10,
      title: 'Atrápelo Quien Pueda',
      start: '2026-11-18T15:15:00-06:00',
      finish: '2026-11-18T17:02:00-06:00',
      feature: '2026-11-18T15:35:00-06:00',
    }),
    makeSession({
      screen: 7,
      title: 'Petardos Y Magnolias',
      start: '2026-11-18T13:00:00-06:00',
      finish: '2026-11-18T14:58:00-06:00',
      feature: '2026-11-18T13:20:00-06:00',
    }),
    makeSession({
      screen: 7,
      title: 'Petardos Y Magnolias',
      start: '2026-11-18T15:40:00-06:00',
      finish: '2026-11-18T17:38:00-06:00',
      feature: '2026-11-18T16:00:00-06:00',
    }),
    makeSession({
      screen: 8,
      title: 'Sala ocho',
      start: '2026-11-18T16:00:00-06:00',
      finish: '2026-11-18T17:02:00-06:00',
      feature: '2026-11-18T16:20:00-06:00',
    }),
  ]

  it('mantiene arriba las salas ya salidas y sin limpiar, la más urgente primero', () => {
    const now = at('2026-11-18T15:10:00-06:00')
    const home = buildHome(sessions, settings, now)
    const pending = home.actuales.filter((group) => Date.parse(group.finish) <= now.getTime())
    expect(pending.map((group) => group.sessions.map((view) => view.session.screen))).toEqual([[10], [7]])
    const sala10 = home.actuales[0].sessions[0]
    expect(statusText(sala10, now)).toBe('Faltan 5 min para la siguiente función (3:15 PM)')
    expect(marginText(sala10, now)).toBeNull()
    const before = buildHome(sessions, settings, at('2026-11-18T14:00:00-06:00'))
    const early = before.actuales.flatMap((group) => group.sessions).find((view) => view.session.finish.includes('T14:55:00'))!
    expect(marginText(early, at('2026-11-18T14:00:00-06:00'))).toBe('Margen 20 min · Justo · siguiente 3:15 PM')
    expect(home.pasadas).toHaveLength(0)
  })

  it('pasa a Pasadas con insignia si nadie la marcó después del límite', () => {
    const now = at('2026-11-18T15:57:00-06:00')
    const home = buildHome(sessions, settings, now)
    const sala10 = home.pasadas.flatMap((group) => group.sessions).find((view) => view.session.finish.includes('T14:55:00'))
    expect(sala10?.unmarked).toBe(true)
    expect(sala10?.section).toBe('pasadas')
    const sala7 = home.actuales.flatMap((group) => group.sessions).find((view) => view.session.screen === 7 && view.session.finish.includes('T14:58:00'))
    expect(sala7?.section).toBe('actuales')
  })

  it('una sala limpia va a Pasadas aunque acabe de salir', () => {
    const marked = sessions.map((session) =>
      session.finish.includes('T14:55:00')
        ? { ...session, clean: true, cleanedAt: '2026-11-18T15:09:00-06:00' }
        : session,
    )
    const now = at('2026-11-18T15:10:00-06:00')
    const home = buildHome(marked, settings, now)
    const sala10 = home.pasadas[0].sessions[0]
    expect(sala10.urgency).toBe('clean')
    expect(statusText(sala10, now)).toBe('Limpia a las 3:09 PM · 6 min antes')
  })

  it('agrupa la misma hora y pone primero el margen más corto', () => {
    const shared = [
      makeSession({
        screen: 8,
        title: 'Corta',
        start: '2026-11-18T15:00:00-06:00',
        finish: '2026-11-18T17:02:00-06:00',
      }),
      makeSession({
        screen: 8,
        title: 'Siguiente corta',
        start: '2026-11-18T17:20:00-06:00',
        finish: '2026-11-18T19:00:00-06:00',
      }),
      makeSession({
        screen: 10,
        title: 'Larga',
        start: '2026-11-18T15:00:00-06:00',
        finish: '2026-11-18T17:02:00-06:00',
      }),
      makeSession({
        screen: 10,
        title: 'Siguiente larga',
        start: '2026-11-18T18:00:00-06:00',
        finish: '2026-11-18T20:00:00-06:00',
      }),
    ]
    const now = at('2026-11-18T16:30:00-06:00')
    const home = buildHome(shared, settings, now)
    const group = home.actuales.find((entry) => entry.sessions.length === 2)
    expect(group?.sessions.map((view) => view.session.screen)).toEqual([8, 10])
    expect(group?.shortestMargin).toBeLessThan(60)
    expect(group?.shortestScreen).toBe(8)
  })

  it('el interruptor invierte solo las que todavía no salen', () => {
    const now = at('2026-11-18T15:10:00-06:00')
    const home = buildHome(sessions, { ...settings, invertUpcoming: true }, now)
    const upcoming = home.actuales.filter((group) => Date.parse(group.finish) > now.getTime())
    expect(upcoming.map((group) => group.finish)).toEqual([
      '2026-11-18T17:38:00-06:00',
      '2026-11-18T17:02:00-06:00',
    ])
    expect(home.actuales[0].sessions[0].session.screen).toBe(10)
  })

  it('advierte si la siguiente empieza antes de que termine la actual', () => {
    const overlap = [
      makeSession({
        screen: 4,
        title: 'Una',
        start: '2026-11-18T13:00:00-06:00',
        finish: '2026-11-18T16:00:00-06:00',
      }),
      makeSession({
        screen: 4,
        title: 'Dos',
        start: '2026-11-18T15:30:00-06:00',
        finish: '2026-11-18T17:00:00-06:00',
      }),
    ]
    const now = at('2026-11-18T14:00:00-06:00')
    const home = buildHome(overlap, settings, now)
    const first = home.actuales[0].sessions[0]
    expect(first.margin.overlap).toBe(true)
    expect(marginText(first, now)).toMatch(/empieza antes/)
  })

  it('el margen de seguridad se resta y puede cambiar la etiqueta', () => {
    const now = at('2026-11-18T14:00:00-06:00')
    const home = buildHome(sessions, { ...settings, safetyMargin: 5 }, now)
    const sala10 = home.actuales.flatMap((group) => group.sessions).find((view) => view.session.screen === 10)!
    expect(sala10.margin.adjustedMinutes).toBe(15)
    expect(sala10.margin.band).toBe('ajustado')
  })
})
