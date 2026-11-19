import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { syncNotifications } from '../services/notifications/scheduler'
import { capacitorFiles } from '../services/storage/capacitorFiles'
import { Repository, applySettings } from '../services/storage/repository'
import { dayFromReport, planReimport } from '../services/storage/reimport'
import type { AppData, ParsedReport, Settings, ThemeChoice } from '../types'

type StoreValue = {
  data: AppData
  ready: boolean
  storageError: string | null
  patchSettings: (patch: Partial<Settings>) => Promise<void>
  toggleClean: (id: string) => Promise<void>
  commitImport: (report: ParsedReport, dropFuture: boolean) => Promise<void>
  finishIntro: () => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)
const repository = new Repository(capacitorFiles)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)

  const persist = useCallback(async (next: AppData) => {
    await repository.save(next)
    const saved = await repository.load()
    setData(saved)
    await syncNotifications(saved)
  }, [])

  useEffect(() => {
    let cancelled = false
    repository
      .load()
      .then(async (loaded) => {
        if (cancelled) return
        setData(loaded)
        await syncNotifications(loaded)
      })
      .catch((error: unknown) => {
        if (!cancelled) setStorageError(error instanceof Error ? error.message : 'No se pudieron leer los datos.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!data) return
    const remove = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void syncNotifications(data)
    })
    return () => {
      void remove.then((handle) => handle.remove())
    }
  }, [data])

  useEffect(() => {
    if (!data) return
    applyTheme(data.settings.theme)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (data.settings.theme === 'system') applyTheme('system')
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [data?.settings.theme])

  const value = useMemo<StoreValue | null>(() => {
    if (!data) return null
    return {
      data,
      ready: true,
      storageError,
      async patchSettings(patch) {
        await persist(applySettings(data, patch))
      },
      async toggleClean(id) {
        const days = data.days.map((day) => ({
          ...day,
          sessions: day.sessions.map((session) => {
            if (session.id !== id) return session
            const clean = !session.clean
            return { ...session, clean, cleanedAt: clean ? new Date().toISOString() : null }
          }),
        }))
        await persist({ ...data, days })
      },
      async commitImport(report, dropFuture) {
        const existing = data.days.find((day) => day.operationalDate === report.operationalDate)
        const plan = planReimport(existing?.sessions ?? [], report.sessions, report.generatedAt)
        const sessions = dropFuture ? plan.dropping : plan.keeping
        const day = dayFromReport(report, sessions, new Date().toISOString())
        const days = data.days.filter((entry) => entry.operationalDate !== report.operationalDate)
        await persist({ ...data, days: [...days, day] })
      },
      async finishIntro() {
        await persist({ ...data, permissionsIntroSeen: true })
      },
    }
  }, [data, persist, storageError])

  if (storageError && !data) {
    return (
      <main className="gate">
        <h1>No se pudieron abrir los datos</h1>
        <p>{storageError}</p>
      </main>
    )
  }
  if (!value) {
    return (
      <main className="gate">
        <p>Cargando el día…</p>
      </main>
    )
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore fuera del proveedor')
  return value
}

function applyTheme(choice: ThemeChoice): void {
  const dark =
    choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  localStorage.setItem('ods-theme', choice)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#111827' : '#F8FAFC')
  if (Capacitor.isNativePlatform()) {
    void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
    void StatusBar.setBackgroundColor({ color: dark ? '#111827' : '#F8FAFC' })
  }
}
