import { User } from 'firebase/auth'
import {
  DashboardData,
  ProductModerationAction,
  ProductItem,
  ProductSaveInput
} from '../entities/admin'

export interface AdminRepository {
  observeAuthState(callback: (user: User | null) => void): () => void
  login(email: string, password: string, rememberMe: boolean): Promise<User>
  logout(): Promise<void>
  getCurrentUser(): User | null
  hasAdminAccess(user: User): Promise<boolean>
  getIdToken(): Promise<string>
  getAdminEmail(user: User | null): string

  loadDashboardData(): Promise<DashboardData>
  resolveReport(reportId: string): Promise<void>
  approvePayout(payoutId: string): Promise<void>
  saveProduct(input: ProductSaveInput): Promise<ProductItem>
  deleteProduct(productId: string): Promise<void>
  moderateProduct(productId: string, action: ProductModerationAction, reason?: string): Promise<void>

  setUserLock(userId: string, disabled: boolean): Promise<void>
  deleteUser(userId: string): Promise<void>

  mapSignInError(error: unknown): string
  mapActionError(error: unknown): string
}
