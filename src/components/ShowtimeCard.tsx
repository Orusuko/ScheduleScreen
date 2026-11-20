import type { SessionView } from '../services/schedule/home'
import { durationMinutes, marginText, statusText } from '../services/schedule/format'
import { formatTime } from '../utils/time'

export function ShowtimeCard({
  view,
  now,
  onToggle,
}: {
  view: SessionView
  now: Date
  onToggle: (id: string) => void
}) {
  const { session } = view
  const duration = durationMinutes(session.feature, session.finish)
  const cleanupDiffers = session.cleanupComplete !== session.finish
  return (
    <article className={`card card--${view.urgency}`}>
      <div className="card__top">
        <time className="card__time" dateTime={session.finish}>
          {formatTime(session.finish)}
        </time>
        <span className="sala">Sala {session.screen}</span>
      </div>
      <h2 className="card__title">{session.title}</h2>
      <p className="chips">
        <span>{session.language}</span>
        {session.format === '3D' && <span>3D</span>}
        <span className="censor">{session.censor}</span>
        {duration > 0 && <span className="muted">{duration} min</span>}
      </p>
      <p className="card__status">{statusText(view, now)}</p>
      {marginText(view, now) && <p className={`margin margin--${view.margin.band ?? 'none'}`}>{marginText(view, now)}</p>}
      {view.unmarked && <p className="badge">Sin marcar</p>}
      {cleanupDiffers && (
        <p className="fine">Cierre de limpieza Vista {formatTime(session.cleanupComplete)}</p>
      )}
      <button type="button" className={session.clean ? 'btn btn-ghost' : 'btn btn-primary'} onClick={() => onToggle(session.id)}>
        {session.clean ? 'Quitar marca' : 'Marcar limpia'}
      </button>
    </article>
  )
}
