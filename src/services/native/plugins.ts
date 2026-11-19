import { Capacitor, registerPlugin, WebPlugin } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export type AlertPayload = { id: number; at: number; title: string; body: string }

type ExactAlertsPlugin = {
  replace(options: { alerts: AlertPayload[] }): Promise<{ scheduled: number }>
  ping(): Promise<void>
}

type DeviceSettingsPlugin = {
  openBatteryOptimization(): Promise<void>
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>
}

type ShareImportPlugin = {
  consume(): Promise<{ base64: string | null; name: string | null }>
  addListener(event: 'pdfReceived', handler: () => void): Promise<{ remove: () => Promise<void> }>
}

class ExactAlertsWeb extends WebPlugin implements ExactAlertsPlugin {
  async replace(): Promise<{ scheduled: number }> {
    return { scheduled: 0 }
  }

  async ping(): Promise<void> {
    if (typeof Notification === 'undefined') {
      throw new Error('Este navegador no puede mostrar avisos.')
    }
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('El aviso de prueba necesita permiso de notificaciones.')
    }
    new Notification('Sala 10 sale en 20 min · margen de limpieza 20 min', {
      body: 'La Venganza Del Charro Negro',
    })
  }
}

class DeviceSettingsWeb extends WebPlugin implements DeviceSettingsPlugin {
  async openBatteryOptimization(): Promise<void> {
    throw new Error('La optimización de batería se ajusta en el teléfono Android.')
  }

  async isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }> {
    return { ignoring: false }
  }
}

class ShareImportWeb extends WebPlugin implements ShareImportPlugin {
  async consume(): Promise<{ base64: string | null; name: string | null }> {
    return { base64: null, name: null }
  }
}

export const ExactAlerts = registerPlugin<ExactAlertsPlugin>('ExactAlerts', {
  web: () => new ExactAlertsWeb(),
})

export const DeviceSettings = registerPlugin<DeviceSettingsPlugin>('DeviceSettings', {
  web: () => new DeviceSettingsWeb(),
})

export const ShareImport = registerPlugin<ShareImportPlugin>('ShareImport', {
  web: () => new ShareImportWeb(),
})

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export async function sendTestNotification(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const permission = await LocalNotifications.requestPermissions()
    if (permission.display !== 'granted') {
      throw new Error('Las notificaciones están desactivadas para la app.')
    }
  }
  await ExactAlerts.ping()
}

export async function notificationPermission(): Promise<string> {
  try {
    const status = await LocalNotifications.checkPermissions()
    return status.display
  } catch {
    return 'unknown'
  }
}

export async function exactAlarmPermission(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return 'granted'
  try {
    const status = await LocalNotifications.checkExactNotificationSetting()
    return status.exact_alarm
  } catch {
    return 'unknown'
  }
}
