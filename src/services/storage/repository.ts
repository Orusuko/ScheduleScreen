import { defaultAppData, type AppData, type OperationalDay, type Settings } from '../../types'
import { retainDays } from './reimport'

export const DATA_FILE = 'schedule.json'
export const TMP_FILE = 'schedule.json.tmp'
export const BAK_FILE = 'schedule.json.bak'

export interface FileStore {
  read(path: string): Promise<string | null>
  write(path: string, data: string): Promise<void>
  remove(path: string): Promise<void>
  rename(from: string, to: string): Promise<void>
}

export class MemoryFiles implements FileStore {
  readonly files = new Map<string, string>()

  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null
  }

  async write(path: string, data: string): Promise<void> {
    this.files.set(path, data)
  }

  async remove(path: string): Promise<void> {
    this.files.delete(path)
  }

  async rename(from: string, to: string): Promise<void> {
    const data = this.files.get(from)
    if (data == null) throw new Error('No existe el archivo temporal')
    this.files.set(to, data)
    this.files.delete(from)
  }
}

export class Repository {
  constructor(private readonly store: FileStore) {}

  async load(): Promise<AppData> {
    const main = parseData(await this.store.read(DATA_FILE))
    if (main) return main
    const tmp = parseData(await this.store.read(TMP_FILE))
    if (tmp) {
      await this.store.write(DATA_FILE, JSON.stringify(tmp))
      await this.store.remove(TMP_FILE)
      return tmp
    }
    const bak = parseData(await this.store.read(BAK_FILE))
    if (bak) {
      await this.store.write(DATA_FILE, JSON.stringify(bak))
      return bak
    }
    const rawMain = await this.store.read(DATA_FILE)
    const rawTmp = await this.store.read(TMP_FILE)
    const rawBak = await this.store.read(BAK_FILE)
    if (rawMain != null || rawTmp != null || rawBak != null) {
      throw new Error('El archivo de datos está dañado. No se reemplazó para no perder la información.')
    }
    return defaultAppData()
  }

  /** Escribe el JSON completo en un temporal y luego lo promueve. */
  async save(data: AppData): Promise<void> {
    const next = { ...data, days: retainDays(data.days) }
    const json = JSON.stringify(next)
    await this.store.write(TMP_FILE, json)
    const current = await this.store.read(DATA_FILE)
    if (current != null) await this.store.write(BAK_FILE, current)
    try {
      await this.store.remove(DATA_FILE)
    } catch {
      // El archivo vigente puede no existir en la primera guarda.
    }
    try {
      await this.store.rename(TMP_FILE, DATA_FILE)
    } catch {
      await this.store.write(DATA_FILE, json)
      await this.store.remove(TMP_FILE)
    }
  }
}

export function parseData(raw: string | null): AppData | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<AppData>
    if (value.schemaVersion !== 1 || !Array.isArray(value.days) || typeof value.settings !== 'object') return null
    return {
      schemaVersion: 1,
      settings: { ...defaultAppData().settings, ...value.settings },
      days: value.days as OperationalDay[],
      permissionsIntroSeen: Boolean(value.permissionsIntroSeen),
    }
  } catch {
    return null
  }
}

export function applySettings(data: AppData, patch: Partial<Settings>): AppData {
  const settings = { ...data.settings, ...patch }
  if (![15, 20, 30].includes(settings.leadMinutes)) settings.leadMinutes = 20
  if (settings.pastAfterMinutes < 1) settings.pastAfterMinutes = 1
  if (settings.tightBelow < 1) settings.tightBelow = 1
  if (settings.comfortableUntil <= settings.tightBelow) settings.comfortableUntil = settings.tightBelow + 1
  if (settings.safetyMargin < 0) settings.safetyMargin = 0
  return { ...data, settings }
}
