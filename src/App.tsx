import { useEffect, useMemo, useState } from 'react'
import { AdminUseCases } from './application/usecases/AdminUseCases'
import { FirebaseAdminRepository } from './infrastructure/repositories/FirebaseAdminRepository'
import { AdminApiClient } from './infrastructure/services/AdminApiClient'
import { useAdminController } from './presentation/controllers/useAdminController'
import { AdminAppView } from './presentation/views/AdminAppView'

type ThemeMode = 'light' | 'dark'
const THEME_STORAGE_KEY = 'unimarket-admin-theme'

function App() {
  const useCases = useMemo(() => {
    const repository = new FirebaseAdminRepository(new AdminApiClient())
    return new AdminUseCases(repository)
  }, [])

  const controller = useAdminController(useCases)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode)
    localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  }, [themeMode])

  return (
    <AdminAppView
      controller={controller}
      themeMode={themeMode}
      onToggleTheme={() => setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'))}
    />
  )
}

export default App
