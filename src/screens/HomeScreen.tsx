import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { Logo } from '../components/Logo'
import { ShowtimeGroup } from '../components/ShowtimeGroup'
import { useNow } from '../hooks/useNow'
import { DeviceSettings } from '../services/native/plugins'
import { buildHome } from '../services/schedule/home'
import { useStore } from '../store/Store'
import { currentOperationalDate, formatOperationalDate, formatTime } from '../utils/time'

export function HomeScreen({ onImport, onSettings }: { onImport: () => void; onSettings: () => void }) {
  const { data, toggleClean } = useStore()
  const now = useNow()
  const [section, setSection] = useState<'actuales' | 'pasadas'>('actuales')
  const [batteryUnrestricted, setBatteryUnrestricted] = useState(false)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const check = () => {
      void DeviceSettings.isIgnoringBatteryOptimizations()
        .then((status) => setBatteryUnrestricted(status.ignoring))
        .catch(() => setBatteryUnrestricted(false))
    }
    check()
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  const operationalDate = currentOperationalDate(now)
  const day = data.days.find((entry) => entry.operationalDate === operationalDate) ?? null
  const home = day ? buildHome(day.sessions, data.settings, now) : null
  const groups = home ? (section === 'actuales' ? home.actuales : home.pasadas) : []

  return (
    <div className="screen">
      <header className="top">
        <Logo />
        <div className="top__copy">
          <p className="brand">Orden de Salidas</p>
          <p className="slogan">Planifica · Limpia · Repite</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Ajustes" onClick={onSettings}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
          </svg>
        </button>
      </header>

      {batteryUnrestricted && (
        <section className="notice">
          <h2>El ahorro de batería está apagado</h2>
          <p>Esta app quedó fuera del ahorro y por eso el teléfono se descarga más rápido. Puedes volver a activarlo: los avisos siguen llegando a su hora.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              void DeviceSettings.openBatterySettings().catch(() => undefined)
            }}
          >
            Activar ahorro
          </button>
        </section>
      )}

      <section className="daybar">
        <p>Día operativo {formatOperationalDate(operationalDate)}</p>
        {day ? (
          <p className="fine">Reporte generado {formatTime(day.generatedAt)}</p>
        ) : (
          <p className="fine">Todavía no hay un reporte para este día.</p>
        )}
      </section>

      {!home ? (
        <div className="empty">
          <h1>Sin funciones para este día</h1>
          <p>Importa el PDF de Vista, Session by Finish Time o Session by Start Time.</p>
          <p>Si el archivo es de otro día pero los horarios son los mismos, al importarlo puedes guardarlo como hoy.</p>
          <button type="button" className="btn btn-primary" onClick={onImport}>
            Importar PDF
          </button>
        </div>
      ) : (
        <>
          <div className="seg" role="tablist" aria-label="Funciones">
            <button type="button" role="tab" aria-selected={section === 'actuales'} onClick={() => setSection('actuales')}>
              Actuales · {count(home.actuales)}
            </button>
            <button type="button" role="tab" aria-selected={section === 'pasadas'} onClick={() => setSection('pasadas')}>
              Pasadas · {count(home.pasadas)}
            </button>
          </div>
          <div className="list">
            {groups.length === 0 ? (
              <p className="empty-inline">{section === 'actuales' ? 'No hay salidas pendientes.' : 'Nada en pasadas.'}</p>
            ) : (
              groups.map((group) => (
                <ShowtimeGroup key={`${section}-${group.finish}`} group={group} now={now} onToggle={(id) => void toggleClean(id)} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

function count(groups: { sessions: unknown[] }[]): number {
  return groups.reduce((sum, group) => sum + group.sessions.length, 0)
}
