/** Tipos del día operativo. El margen no se guarda: se calcula al vuelo. */

export type ReportType = 'finish-time' | 'start-time'

export type Language = 'Esp' | 'Sub'

export type FilmFormat = '2D' | '3D'

export type ThemeChoice = 'light' | 'dark' | 'system'

export type LeadMinutes = 15 | 20 | 30

export type Session = {
  /** Fecha operativa + sala + inicio. Cambia si Vista mueve la hora de entrada. */
  id: string
  start: string
  feature: string
  finish: string
  cleanupComplete: string
  screen: number
  title: string
  language: Language
  format: FilmFormat
  censor: string
  seatAllocation: string
  privateScreening: string | null
  clean: boolean
  cleanedAt: string | null
}

export type OperationalDay = {
  operationalDate: string
  reportType: ReportType
  rangeStart: string
  rangeEnd: string
  generatedAt: string
  importedAt: string
  sessions: Session[]
}

export type Settings = {
  notificationsEnabled: boolean
  leadMinutes: LeadMinutes
  invertUpcoming: boolean
  sortByUrgency: boolean
  pastAfterMinutes: number
  /** Menos de este valor es Ajustado. */
  tightBelow: number
  /** Más de este valor es Holgado. Entre ambos, inclusive, es Justo. */
  comfortableUntil: number
  safetyMargin: number
  theme: ThemeChoice
}

export type AppData = {
  schemaVersion: 1
  settings: Settings
  days: OperationalDay[]
  permissionsIntroSeen: boolean
}

export type ParsedReport = {
  reportType: ReportType
  operationalDate: string
  rangeStart: string
  rangeEnd: string
  generatedAt: string
  sessions: Session[]
}

export const DEFAULT_SETTINGS: Settings = {
  notificationsEnabled: true,
  leadMinutes: 20,
  invertUpcoming: false,
  sortByUrgency: false,
  pastAfterMinutes: 60,
  tightBelow: 20,
  comfortableUntil: 30,
  safetyMargin: 0,
  theme: 'system',
}

export function defaultAppData(): AppData {
  return {
    schemaVersion: 1,
    settings: { ...DEFAULT_SETTINGS },
    days: [],
    permissionsIntroSeen: false,
  }
}

export function sessionId(operationalDate: string, screen: number, start: string): string {
  return `${operationalDate}|${screen}|${start}`
}
