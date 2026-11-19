import type { FilmFormat, Language } from '../../types'

/** Separa «El Laberinto Del Fauno 3D Esp» en título, formato e idioma. */
export function splitTitle(raw: string): { title: string; language: Language; format: FilmFormat } | null {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  const match = cleaned.match(/^(.*?)(?:\s+(3D))?\s+(Esp|Sub)$/i)
  if (!match) return null
  const title = match[1].trim()
  if (!title) return null
  return {
    title,
    language: match[3].toLowerCase() === 'sub' ? 'Sub' : 'Esp',
    format: match[2] ? '3D' : '2D',
  }
}
