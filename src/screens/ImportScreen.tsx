import { useEffect, useState } from 'react'
import { Logo } from '../components/Logo'
import { ImportError } from '../services/pdf/errors'
import { reconstruct } from '../services/pdf/reconstruct'
import { shiftReportToOperationalDate } from '../services/schedule/reuseDay'
import { planReimport, type ReimportPlan } from '../services/storage/reimport'
import { useNow } from '../hooks/useNow'
import { useStore } from '../store/Store'
import type { ParsedReport } from '../types'
import { currentOperationalDate, formatDateTime, formatOperationalDate, formatTime } from '../utils/time'

type Preview = { report: ParsedReport; plan: ReimportPlan }
type PendingSave = { report: ParsedReport; plan: ReimportPlan }

export function ImportScreen({ sharedPdf, onConsumed }: { sharedPdf: Uint8Array | null; onConsumed: () => void }) {
  const { data, commitImport } = useStore()
  const now = useNow()
  const today = currentOperationalDate(now)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingSave | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    if (!sharedPdf) return
    void readBytes(sharedPdf)
    onConsumed()
    // El PDF compartido se procesa una sola vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedPdf])

  async function readBytes(bytes: Uint8Array) {
    setBusy(true)
    setError(null)
    setSaved(null)
    setPending(null)
    try {
      const { extractPdfPages } = await import('../services/pdf/extract')
      const report = reconstruct(await extractPdfPages(bytes))
      const existing = data.days.find((day) => day.operationalDate === report.operationalDate)
      const plan = planReimport(existing?.sessions ?? [], report.sessions, report.generatedAt)
      setPreview({ report, plan })
    } catch (cause) {
      setPreview(null)
      setError(cause instanceof ImportError ? cause.message : 'No se pudo leer el PDF.')
    } finally {
      setBusy(false)
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    await readBytes(new Uint8Array(await file.arrayBuffer()))
  }

  function planFor(report: ParsedReport): ReimportPlan {
    const existing = data.days.find((day) => day.operationalDate === report.operationalDate)
    return planReimport(existing?.sessions ?? [], report.sessions, report.generatedAt)
  }

  function beginSave(report: ParsedReport) {
    const plan = planFor(report)
    if (plan.disappearedFuture.length > 0) {
      setPending({ report, plan })
      return
    }
    void finishSave(report, false)
  }

  async function finishSave(report: ParsedReport, dropFuture: boolean) {
    setBusy(true)
    try {
      await commitImport(report, dropFuture)
      const asToday = preview != null && report.operationalDate !== preview.report.operationalDate
      setPreview(null)
      setPending(null)
      setSaved(
        asToday
          ? `Listo. Los horarios quedaron en el día operativo ${formatOperationalDate(report.operationalDate)}.`
          : 'Reporte guardado. Las marcas de limpia se conservaron.',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el reporte.')
    } finally {
      setBusy(false)
    }
  }

  const otherDay = preview != null && preview.report.operationalDate !== today
  const todayReport = otherDay && preview ? shiftReportToOperationalDate(preview.report, today) : null
  const todayPlan = todayReport ? planFor(todayReport) : null
  const dayEnded = preview ? Date.parse(preview.report.rangeEnd) <= Date.now() : false
  const screens = preview
    ? [...new Set(preview.report.sessions.map((session) => session.screen))].sort((a, b) => a - b)
    : []

  return (
    <div className="screen">
      <header className="page-head">
        <Logo size={36} />
        <div>
          <h1>Importar</h1>
          <p className="fine">El PDF se lee en el teléfono. No sale de aquí.</p>
        </div>
      </header>

      <label className="drop">
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => {
            void onFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <strong>{busy ? 'Leyendo el reporte…' : 'Elegir PDF de Vista'}</strong>
        <span>Session by Finish Time o Session by Start Time</span>
      </label>

      {error && <p className="alert">{error}</p>}
      {saved && <p className="ok">{saved}</p>}

      {preview && (
        <section className="panel">
          <h2>Vista previa</h2>
          <dl className="facts">
            <div>
              <dt>Tipo</dt>
              <dd>{preview.report.reportType === 'finish-time' ? 'Por hora de salida' : 'Por hora de inicio'}</dd>
            </div>
            <div>
              <dt>Día operativo</dt>
              <dd>{formatOperationalDate(preview.report.operationalDate)}</dd>
            </div>
            <div>
              <dt>Generado</dt>
              <dd>{formatTime(preview.report.generatedAt)}</dd>
            </div>
            <div>
              <dt>Funciones</dt>
              <dd>{preview.report.sessions.length}</dd>
            </div>
            <div className="span-2">
              <dt>Salas</dt>
              <dd>{screens.join(', ')}</dd>
            </div>
            <div>
              <dt>Nuevas</dt>
              <dd>{preview.plan.added.length}</dd>
            </div>
            <div>
              <dt>Cambios</dt>
              <dd>{preview.plan.updated.length}</dd>
            </div>
          </dl>
          {preview.plan.keptPast.length > 0 && (
            <p className="fine">
              Se conservan {preview.plan.keptPast.length} funciones que ya habían terminado y no vienen en este archivo.
            </p>
          )}
          {otherDay && todayReport && todayPlan && (
            <div className="notice">
              <h2>No es el día de hoy</h2>
              <p>
                Este PDF es del día operativo {formatOperationalDate(preview.report.operationalDate)}. Hoy es{' '}
                {formatOperationalDate(today)}, así que Inicio no lo mostraría.
              </p>
              <p>
                Si estos horarios se repiten, puedes guardarlo como el día de hoy. Las horas se quedan igual y la fecha
                pasa a ser la de hoy.
              </p>
              {todayPlan.updated.length > 0 || todayPlan.keptPast.length > 0 ? (
                <p className="fine">
                  Hoy ya hay funciones guardadas: {todayPlan.added.length} nuevas y {todayPlan.updated.length} con
                  cambio. Las salas marcadas limpias se conservan.
                </p>
              ) : (
                <p className="fine">{todayReport.sessions.length} funciones quedarían en el día de hoy.</p>
              )}
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => beginSave(todayReport)}>
                Guardar como hoy
              </button>
            </div>
          )}
          {dayEnded && !otherDay && <p className="alert">Este día operativo ya terminó. Puedes guardarlo igual.</p>}
          <div className="row-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)} disabled={busy}>
              Cancelar
            </button>
            <button
              type="button"
              className={otherDay ? 'btn btn-ghost' : 'btn btn-primary'}
              disabled={busy}
              onClick={() => beginSave(preview.report)}
            >
              {otherDay ? 'Guardar con la fecha del PDF' : 'Guardar reporte'}
            </button>
          </div>
        </section>
      )}

      {pending && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="drop-title">
          <div className="modal__card">
            <h2 id="drop-title">Funciones que ya no vienen</h2>
            <p>
              {pending.plan.disappearedFuture.length} funciones todavía no salían cuando se generó el reporte y ya no
              aparecen. ¿Las quito?
            </p>
            <ul className="drop-list">
              {pending.plan.disappearedFuture.map((session) => (
                <li key={session.id}>
                  Sala {session.screen} · {formatTime(session.finish)} · {session.title}
                </li>
              ))}
            </ul>
            <div className="row-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => void finishSave(pending.report, false)}>
                Conservarlas
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void finishSave(pending.report, true)}>
                Quitarlas
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="fine share-note">
        También puedes compartir el PDF hacia Orden de Salidas. La última importación queda en Ajustes
        {data.days[0] ? ` · ${formatDateTime(data.days.slice().sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0].importedAt)}` : ''}.
      </p>
    </div>
  )
}
