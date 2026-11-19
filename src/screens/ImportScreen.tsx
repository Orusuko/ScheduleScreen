import { useEffect, useState } from 'react'
import { Logo } from '../components/Logo'
import { ImportError } from '../services/pdf/errors'
import { reconstruct } from '../services/pdf/reconstruct'
import { planReimport, type ReimportPlan } from '../services/storage/reimport'
import { useStore } from '../store/Store'
import type { ParsedReport } from '../types'
import { formatDateTime, formatOperationalDate, formatTime } from '../utils/time'

type Preview = { report: ParsedReport; plan: ReimportPlan }

export function ImportScreen({ sharedPdf, onConsumed }: { sharedPdf: Uint8Array | null; onConsumed: () => void }) {
  const { data, commitImport } = useStore()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [askDrop, setAskDrop] = useState(false)
  const [saved, setSaved] = useState(false)

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
    setSaved(false)
    setAskDrop(false)
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

  async function save(dropFuture: boolean) {
    if (!preview) return
    setBusy(true)
    try {
      await commitImport(preview.report, dropFuture)
      setPreview(null)
      setAskDrop(false)
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el reporte.')
    } finally {
      setBusy(false)
    }
  }

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
      {saved && <p className="ok">Reporte guardado. Las marcas de limpia se conservaron.</p>}

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
          {dayEnded && <p className="alert">Este día operativo ya terminó. Puedes guardarlo igual.</p>}
          <div className="row-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)} disabled={busy}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => {
                if (preview.plan.disappearedFuture.length > 0) setAskDrop(true)
                else void save(false)
              }}
            >
              Guardar reporte
            </button>
          </div>
        </section>
      )}

      {askDrop && preview && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="drop-title">
          <div className="modal__card">
            <h2 id="drop-title">Funciones que ya no vienen</h2>
            <p>
              {preview.plan.disappearedFuture.length} funciones todavía no salían cuando se generó el reporte y ya no
              aparecen. ¿Las quito?
            </p>
            <ul className="drop-list">
              {preview.plan.disappearedFuture.map((session) => (
                <li key={session.id}>
                  Sala {session.screen} · {formatTime(session.finish)} · {session.title}
                </li>
              ))}
            </ul>
            <div className="row-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAskDrop(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => void save(false)}>
                Conservarlas
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void save(true)}>
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
