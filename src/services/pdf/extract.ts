import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { RawPage } from './reconstruct'

let configured = false

/** El worker va dentro del paquete. En pruebas se puede fijar antes una ruta de Node. */
export function configurePdfWorker(): void {
  if (configured || GlobalWorkerOptions.workerSrc) {
    configured = true
    return
  }
  GlobalWorkerOptions.workerSrc = workerSrc
  configured = true
}

export async function extractPdfPages(data: Uint8Array): Promise<RawPage[]> {
  configurePdfWorker()
  const task = getDocument({
    data: data.slice(),
    isEvalSupported: false,
    useSystemFonts: true,
  })
  const doc = await task.promise
  const pages: RawPage[] = []
  try {
    for (let index = 1; index <= doc.numPages; index += 1) {
      const page = await doc.getPage(index)
      const content = await page.getTextContent()
      const items = []
      for (const item of content.items) {
        if (!('str' in item)) continue
        const text = item.str.trim()
        if (!text) continue
        items.push({
          text,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width || Math.max(8, text.length * 4),
        })
      }
      pages.push({ items })
    }
  } finally {
    await doc.destroy()
  }
  return pages
}
