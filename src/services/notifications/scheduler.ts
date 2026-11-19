import type { AppData } from '../../types'
import { ExactAlerts } from '../native/plugins'
import { planNotifications } from './plan'

/** Reemplaza todas las alarmas con el plan vigente. En el navegador no hay alarma de fondo. */
export async function syncNotifications(data: AppData, now = new Date()): Promise<void> {
  const plan = planNotifications(data, now)
  try {
    await ExactAlerts.replace({
      alerts: plan.map((alert) => ({
        id: alert.id,
        at: Date.parse(alert.at),
        title: alert.title,
        body: alert.body,
      })),
    })
  } catch {
    // Sin permiso de alarma exacta el teléfono no puede prometer la hora. La pantalla de ajustes lo explica.
  }
}

export function plannedCount(data: AppData, now = new Date()): number {
  return planNotifications(data, now).length
}
