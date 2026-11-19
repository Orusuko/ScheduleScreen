import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Logo } from '../components/Logo'
import { DeviceSettings } from '../services/native/plugins'
import { useStore } from '../store/Store'

export function PermissionsScreen() {
  const { finishIntro } = useStore()
  return (
    <div className="screen screen--intro">
      <Logo size={64} />
      <h1>Orden de Salidas</h1>
      <p className="slogan">Planifica · Limpia · Repite</p>
      <p className="lead">
        Los avisos llegan con la pantalla bloqueada. Puedes continuar sin concederlos: la lista y la limpieza siguen
        funcionando.
      </p>
      <article className="panel">
        <h2>Notificaciones</h2>
        <p>Un aviso por cada hora de salida, con la sala y el margen de limpieza.</p>
        <button type="button" className="btn btn-primary" onClick={() => void LocalNotifications.requestPermissions()}>
          Permitir notificaciones
        </button>
      </article>
      <article className="panel">
        <h2>Alarmas exactas</h2>
        <p>Android puede retrasar un aviso si no autorizas las alarmas exactas. En este teléfono el permiso se concede al instalar; si no, ábrelo aquí.</p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void LocalNotifications.changeExactNotificationSetting()}
        >
          Revisar alarmas exactas
        </button>
      </article>
      <article className="panel">
        <h2>Batería</h2>
        <p>
          {Capacitor.isNativePlatform()
            ? 'Algunas marcas cierran la app en segundo plano. Excluirla evita que se pierdan los avisos.'
            : 'En el teléfono Android podrás excluir la app de la optimización de batería.'}
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            void DeviceSettings.openBatteryOptimization().catch(() => undefined)
          }}
        >
          Excluir de la optimización
        </button>
      </article>
      <button type="button" className="btn btn-primary" onClick={() => void finishIntro()}>
        Continuar
      </button>
    </div>
  )
}
