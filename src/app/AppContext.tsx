/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createEmptyData } from '../domain/defaults'
import type { AppData } from '../domain/types'
import { loadAppData, saveAppData } from '../storage/database'

type DataUpdater = AppData | ((previous: AppData) => AppData)

interface AppContextValue {
  data: AppData
  ready: boolean
  updateData: (updater: DataUpdater, message?: string) => void
  replaceData: (data: AppData, message?: string) => void
  clearAllData: () => void
  announce: (message: string) => void
  announcement: string
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => createEmptyData())
  const [ready, setReady] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    let active = true
    void loadAppData()
      .then((saved) => {
        if (active) setData(saved)
      })
      .catch(() => {
        if (active) setAnnouncement('Local data could not be opened. MyHub is using temporary empty data.')
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    void saveAppData(data).catch(() =>
      setAnnouncement('Changes could not be saved. Export your data before closing this tab.'),
    )
  }, [data, ready])

  useEffect(() => {
    const mode =
      data.settings.appearance === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : data.settings.appearance
    document.documentElement.dataset.theme = mode
    document.documentElement.style.colorScheme = mode
  }, [data.settings.appearance])

  const announce = useCallback((message: string) => {
    setAnnouncement('')
    window.setTimeout(() => setAnnouncement(message), 20)
  }, [])

  const updateData = useCallback(
    (updater: DataUpdater, message?: string) => {
      setData((previous) => (typeof updater === 'function' ? updater(previous) : updater))
      if (message) announce(message)
    },
    [announce],
  )

  const replaceData = useCallback(
    (next: AppData, message = 'Data imported successfully.') => {
      setData(next)
      announce(message)
    },
    [announce],
  )

  const clearAllData = useCallback(() => {
    setData(createEmptyData())
    announce('All MyHub records were cleared. Active encrypted sync will propagate the empty state.')
  }, [announce])

  const value = useMemo(
    () => ({ data, ready, updateData, replaceData, clearAllData, announce, announcement }),
    [data, ready, updateData, replaceData, clearAllData, announce, announcement],
  )

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="sr-live" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </AppContext.Provider>
  )
}

export const useApp = (): AppContextValue => {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider.')
  return context
}
