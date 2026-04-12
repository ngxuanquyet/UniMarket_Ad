import { useMemo } from 'react'
import { AdminUseCases } from './application/usecases/AdminUseCases'
import { FirebaseAdminRepository } from './infrastructure/repositories/FirebaseAdminRepository'
import { AdminApiClient } from './infrastructure/services/AdminApiClient'
import { useAdminController } from './presentation/controllers/useAdminController'
import { AdminAppView } from './presentation/views/AdminAppView'

function App() {
  const useCases = useMemo(() => {
    const repository = new FirebaseAdminRepository(new AdminApiClient())
    return new AdminUseCases(repository)
  }, [])

  const controller = useAdminController(useCases)

  return <AdminAppView controller={controller} />
}

export default App
