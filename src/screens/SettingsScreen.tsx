import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useEffect, useState } from 'react'
import {
  DeviceSettings,
  exactAlarmPermission,
  notificationPermission,
  sendTestNotification,
} from '../services/native/plugins'
import { plannedCount } from '../services/notifications/scheduler'
import { useStore } from '../store/Store'
import type { LeadMinutes, ThemeChoice } from '../types'
import { formatDateTime, formatOperationalDate } from '../utils/time'

export function SettingsScreen() {
  const { data, patchSettings } = useStore()
  const { settings } = data
  const [message, setMessage] = useState<string | null>(null)
  const [permissions, setPermissions] = useState({ notifications: '…', exact: '…', battery: '…', unrestricted: false })

  async function refreshPermissions() {
    const notifications = await notificationPermission()
    const exact = await exactAlarmPermission()
    let battery = 'En el teléfono'
    let unrestricted = false
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await DeviceSettings.isIgnoringBatteryOptimizations()
        unrestricted = status.ignoring
        battery = status.ignoring ? 'Sin ahorro · gasta más' : 'Con ahorro'
      } catch {
        battery = 'No disponible'
      }
    }
    setPermissions({
      notifications: labelPermission(notifications),
      exact: Capacitor.isNativePlatform() ? labelPermission(exact) : 'Se pide en Android',
      battery,
      unrestricted,
    })
  }

  useEffect(() => {
    void refreshPermissions()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshPermissions()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const days = [...data.days].sort((a, b) => b.operationalDate.localeCompare(a.operationalDate))
  const lastImport = days.map((day) => day.importedAt).sort().at(-1)

  return (
    <div className="screen">
      <header className="page-head">
        <div>
          <h1>Ajustes</h1>
          <p className="fine">{plannedCount(data)} avisos programados con la hora actual.</p>
        </div>
      </header>

      {message && <p className="ok">{message}</p>}

      <section className="panel">
        <h2>Notificaciones</h2>
        <Toggle
          label="Activar avisos"
          checked={settings.notificationsEnabled}
          onChange={(notificationsEnabled) => void patchSettings({ notificationsEnabled })}
        />
        <p className="fine">Aviso antes de la salida</p>
        <div className="seg seg--3">
          {([15, 20, 30] as LeadMinutes[]).map((minutes) => (
            <button
              key={minutes}
              type="button"
              aria-pressed={settings.leadMinutes === minutes}
              onClick={() => void patchSettings({ leadMinutes: minutes })}
            >
              {minutes} min
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            void sendTestNotification()
              .then(() => setMessage('Envié un aviso de prueba.'))
              .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo probar el aviso.'))
          }}
        >
          Probar notificación
        </button>
      </section>

      <section className="panel">
        <h2>Lista</h2>
        <Toggle
          label="Invertir las próximas salidas"
          checked={settings.invertUpcoming}
          onChange={(invertUpcoming) => void patchSettings({ invertUpcoming })}
        />
        <Toggle
          label="Ordenar por urgencia de limpieza"
          checked={settings.sortByUrgency}
          onChange={(sortByUrgency) => void patchSettings({ sortByUrgency })}
        />
        <NumberField
          label="Minutos para pasar a Pasadas"
          value={settings.pastAfterMinutes}
          min={1}
          onChange={(pastAfterMinutes) => void patchSettings({ pastAfterMinutes })}
        />
      </section>

      <section className="panel">
        <h2>Margen de limpieza</h2>
        <NumberField
          label="Ajustado: menos de"
          value={settings.tightBelow}
          min={1}
          suffix="min"
          onChange={(tightBelow) => void patchSettings({ tightBelow })}
        />
        <NumberField
          label="Holgado: más de"
          value={settings.comfortableUntil}
          min={settings.tightBelow + 1}
          suffix="min"
          onChange={(comfortableUntil) => void patchSettings({ comfortableUntil })}
        />
        <NumberField
          label="Margen de seguridad"
          value={settings.safetyMargin}
          min={0}
          suffix="min"
          onChange={(safetyMargin) => void patchSettings({ safetyMargin })}
        />
        <p className="fine">El margen de seguridad se resta al tiempo libre. La cuenta regresiva sigue siendo la hora real de entrada.</p>
      </section>

      <section className="panel">
        <h2>Apariencia</h2>
        <div className="seg seg--3">
          {(
            [
              ['light', 'Claro'],
              ['dark', 'Oscuro'],
              ['system', 'Auto'],
            ] as [ThemeChoice, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={settings.theme === value}
              onClick={() => void patchSettings({ theme: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Permisos</h2>
        <PermissionRow label="Notificaciones" value={permissions.notifications} action="Permitir" onAction={() => void LocalNotifications.requestPermissions().then(() => refreshPermissions())} />
        <PermissionRow
          label="Alarmas exactas"
          value={permissions.exact}
          action="Abrir"
          onAction={() => void LocalNotifications.changeExactNotificationSetting().then(() => refreshPermissions())}
        />
        <PermissionRow
          label="Batería"
          value={permissions.battery}
          action={permissions.unrestricted ? 'Activar ahorro' : ''}
          onAction={() => {
            void DeviceSettings.openBatterySettings()
              .then(() => refreshPermissions())
              .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No disponible en el navegador.'))
          }}
        />
        {permissions.unrestricted && (
          <p className="fine">
            Esta app está fuera del ahorro de batería. Puedes volver a activarlo: los avisos siguen llegando a su hora.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Almacenamiento</h2>
        <p className="fine">Se conservan los últimos tres días operativos, solo en este teléfono.</p>
        {lastImport && <p>Última importación {formatDateTime(lastImport)}</p>}
        <ul className="day-list">
          {days.map((day) => (
            <li key={day.operationalDate}>
              <strong>{formatOperationalDate(day.operationalDate)}</strong>
              <span>
                {day.sessions.length} funciones · {day.reportType === 'finish-time' ? 'por salida' : 'por inicio'}
              </span>
            </li>
          ))}
          {days.length === 0 && <li>No hay reportes guardados.</li>}
        </ul>
      </section>

      <section className="panel about">
        <h2>Orden de Salidas</h2>
        <p>Versión 1.0.0</p>
        <p>Sistema local de organización de salidas y limpieza de salas.</p>
        <p className="slogan">Planifica · Limpia · Repite</p>
      </section>
    </div>
  )
}

function labelPermission(value: string): string {
  if (value === 'granted') return 'Concedido'
  if (value === 'denied') return 'Denegado'
  if (value === 'prompt') return 'Sin pedir'
  return 'No disponible'
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

function NumberField({
  label,
  value,
  min,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <span>
        <input
          type="number"
          min={min}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next)) onChange(Math.max(min, Math.round(next)))
          }}
        />
        {suffix && <em>{suffix}</em>}
      </span>
    </label>
  )
}

function PermissionRow({
  label,
  value,
  action,
  onAction,
}: {
  label: string
  value: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="perm">
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
      {action !== '' && (
        <button type="button" className="btn btn-ghost" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}
