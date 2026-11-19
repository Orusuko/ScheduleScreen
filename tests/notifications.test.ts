import { describe, expect, it } from 'vitest'
import { planNotifications } from '../src/services/notifications/plan'
import { defaultAppData, type AppData } from '../src/types'
import { makeSession } from './support'

function dataWith(sessions: ReturnType<typeof makeSession>[], lead: 15 | 20 | 30 = 20): AppData {
  const data = defaultAppData()
  data.settings.leadMinutes = lead
  data.days = [
    {
      operationalDate: '2026-11-18',
      reportType: 'finish-time',
      rangeStart: '2026-11-18T06:00:00-06:00',
      rangeEnd: '2026-11-19T06:00:00-06:00',
      generatedAt: '2026-11-18T12:28:41-06:00',
      importedAt: '2026-11-18T12:40:00-06:00',
      sessions,
    },
  ]
  return data
}

describe('plan de avisos', () => {
  const sala10 = makeSession({
    screen: 10,
    title: 'La Venganza Del Charro Negro',
    start: '2026-11-18T13:10:00-06:00',
    finish: '2026-11-18T14:55:00-06:00',
  })
  const sala8 = makeSession({
    screen: 8,
    title: 'Atrápelo Quien Pueda',
    start: '2026-11-18T14:25:00-06:00',
    finish: '2026-11-18T14:55:00-06:00',
  })
  const noche = makeSession({
    screen: 1,
    title: 'Los Juegos Del Hambre: Amanecer',
    start: '2026-11-18T21:05:00-06:00',
    finish: '2026-11-19T00:03:00-06:00',
  })

  it('agrupa la misma salida y no programa avisos vencidos ni salas limpias', () => {
    const now = new Date('2026-11-18T15:00:00-06:00')
    const alerts = planNotifications(dataWith([{ ...sala10, clean: true }, sala8, noche]), now)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].at).toBe('2026-11-18T23:43:00-06:00')
    expect(alerts[0].title).toMatch(/Sala 1 sale en 20 min/)
    expect(alerts[0].title).toMatch(/última función/)
  })

  it('arma el texto individual y el agrupado', () => {
    const now = new Date('2026-11-18T12:00:00-06:00')
    const alerts = planNotifications(
      dataWith([
        sala10,
        sala8,
        makeSession({
          screen: 10,
          title: 'Siguiente',
          start: '2026-11-18T15:15:00-06:00',
          finish: '2026-11-18T17:00:00-06:00',
        }),
      ]),
      now,
    )
    const grouped = alerts.find((alert) => alert.title.includes('salas'))
    expect(grouped?.title).toBe('2 salas salen en 20 min · margen más corto 20 min (Sala 10)')
    expect(grouped?.at).toBe('2026-11-18T14:35:00-06:00')
    const single = alerts.find((alert) => alert.title.startsWith('Sala 10'))
    expect(single?.body).toBe('Siguiente')
  })

  it('no deja avisos si las notificaciones están apagadas', () => {
    const data = dataWith([noche])
    data.settings.notificationsEnabled = false
    expect(planNotifications(data, new Date('2026-11-18T12:00:00-06:00'))).toEqual([])
  })
})
