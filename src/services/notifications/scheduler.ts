import type { AppData } from '../../types'
import { ExactAlerts } from '../native/plugins'
import { planNotifications } from './plan'

let syncedPlan = ''

/** Manda el plan al teléfono. Si no cambió, no rearma la alarma. */
export async function syncNotifications(data: AppData, now = new Date()): Promise<void> {
  const alerts = planNotifications(data, now).map((alert) => ({
    id: alert.id,
    at: Date.parse(alert.at),
    title: alert.title,
    body: alert.body,
  }))
  const fingerprint = JSON.stringify(alerts)
  if (fingerprint === syncedPlan) return
  try {
    await ExactAlerts.replace({ alerts })
    syncedPlan = fingerprint
  } catch {
    // Sin permiso de alarma exacta el teléfono no puede prometer la hora. La pantalla de ajustes lo explica.
  }
}

export function plannedCount(data: AppData, now = new Date()): number {
  return planNotifications(data, now).length
}
