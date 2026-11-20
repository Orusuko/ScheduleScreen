import { LocalNotifications } from '@capacitor/local-notifications'
import { Logo } from '../components/Logo'
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
        <p>
          Android puede retrasar un aviso si no autorizas las alarmas exactas. En este teléfono el permiso se concede al
          instalar; si no, ábrelo aquí. No hace falta quitar el ahorro de batería.
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void LocalNotifications.changeExactNotificationSetting()}
        >
          Revisar alarmas exactas
        </button>
      </article>
      <button type="button" className="btn btn-primary" onClick={() => void finishIntro()}>
        Continuar
      </button>
    </div>
  )
}
