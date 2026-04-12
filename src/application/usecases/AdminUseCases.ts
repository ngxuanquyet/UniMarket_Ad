import { User } from 'firebase/auth'
import {
  DashboardData,
  ProductSaveInput
} from '../../domain/entities/admin'
import { AdminRepository } from '../../domain/repositories/AdminRepository'

export class AdminUseCases {
  constructor(private readonly repository: AdminRepository) {}

  observeAuthState(callback: (user: User | null) => void): () => void {
    return this.repository.observeAuthState(callback)
  }

  login(email: string, password: string, rememberMe: boolean): Promise<User> {
    return this.repository.login(email, password, rememberMe)
  }

  logout(): Promise<void> {
    return this.repository.logout()
  }

  getCurrentUser(): User | null {
    return this.repository.getCurrentUser()
  }

  getAdminEmail(user: User | null): string {
    return this.repository.getAdminEmail(user)
  }

  hasAdminAccess(user: User): Promise<boolean> {
    return this.repository.hasAdminAccess(user)
  }

  loadDashboardData(): Promise<DashboardData> {
    return this.repository.loadDashboardData()
  }

  resolveReport(reportId: string): Promise<void> {
    return this.repository.resolveReport(reportId)
  }

  approvePayout(payoutId: string): Promise<void> {
    return this.repository.approvePayout(payoutId)
  }

  saveProduct(input: ProductSaveInput) {
    return this.repository.saveProduct(input)
  }

  deleteProduct(productId: string): Promise<void> {
    return this.repository.deleteProduct(productId)
  }

  setUserLock(userId: string, disabled: boolean): Promise<void> {
    return this.repository.setUserLock(userId, disabled)
  }

  deleteUser(userId: string): Promise<void> {
    return this.repository.deleteUser(userId)
  }

  mapSignInError(error: unknown): string {
    return this.repository.mapSignInError(error)
  }

  mapActionError(error: unknown): string {
    return this.repository.mapActionError(error)
  }
}
