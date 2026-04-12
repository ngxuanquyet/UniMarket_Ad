import { FirebaseError } from 'firebase/app'
import {
  User,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth'
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore'
import {
  DashboardData,
  ProductItem,
  ProductSaveInput,
  ReportItem,
  UserItem,
  defaultDashboardStats
} from '../../domain/entities/admin'
import { AdminRepository } from '../../domain/repositories/AdminRepository'
import { auth, db } from '../firebase/firebaseClient'
import { AdminApiClient, getAdminApiBaseUrl } from '../services/AdminApiClient'

function toMillis(value: unknown): number {
  if (typeof value === 'number') return value
  if (value instanceof Timestamp) return value.toMillis()
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const maybeFn = (value as { toMillis?: unknown }).toMillis
    if (typeof maybeFn === 'function') {
      return Number(maybeFn.call(value)) || 0
    }
  }
  return 0
}

function toPayoutMoney(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function toNumberOrNull(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export class FirebaseAdminRepository implements AdminRepository {
  constructor(private readonly adminApiClient: AdminApiClient) {}

  observeAuthState(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback)
  }

  async login(email: string, password: string, rememberMe: boolean): Promise<User> {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
    const credential = await signInWithEmailAndPassword(auth, email, password)
    return credential.user
  }

  async logout(): Promise<void> {
    await signOut(auth)
  }

  getCurrentUser(): User | null {
    return auth.currentUser
  }

  getAdminEmail(user: User | null): string {
    return user?.email || 'Admin'
  }

  async hasAdminAccess(user: User): Promise<boolean> {
    const result = await user.getIdTokenResult(true)
    const claims = result.claims as { admin?: boolean; moderator?: boolean }
    return claims.admin === true || claims.moderator === true
  }

  async getIdToken(): Promise<string> {
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('Admin session is missing. Please sign in again.')
    }
    return currentUser.getIdToken()
  }

  async loadDashboardData(): Promise<DashboardData> {
    const [usersSnapshot, productsSnapshot, reportsSnapshot] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'products')),
      getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(25)))
    ])

    const users: UserItem[] = usersSnapshot.docs.map((userDoc) => {
      const data = userDoc.data()
      const accountStatus =
        typeof data.accountStatus === 'string' ? data.accountStatus.toUpperCase() : ''
      const isLocked =
        data.isLock === true ||
        data.authDisabled === true ||
        data.disabled === true ||
        accountStatus === 'LOCKED'

      return {
        id: userDoc.id,
        name:
          (typeof data.name === 'string' && data.name.trim()) ||
          (typeof data.displayName === 'string' && data.displayName.trim()) ||
          userDoc.id,
        email: (typeof data.email === 'string' && data.email.trim()) || '-',
        isLocked
      }
    })

    const usersMap = new Map<string, string>()
    users.forEach((item) => usersMap.set(item.id, item.name))

    const products: ProductItem[] = productsSnapshot.docs.map((productDoc) => {
      const data = productDoc.data()
      const moderationStatus =
        typeof data.moderationStatus === 'string'
          ? data.moderationStatus
          : typeof data.status === 'string'
            ? data.status
            : 'UNKNOWN'
      const sellerId =
        (typeof data.userId === 'string' && data.userId.trim()) ||
        (typeof data.sellerId === 'string' && data.sellerId.trim()) ||
        ''
      const imageUrls = Array.isArray(data.imageUrls)
        ? data.imageUrls.filter((item): item is string => typeof item === 'string')
        : []
      const quantityAvailable =
        typeof data.quantityAvailable === 'number'
          ? data.quantityAvailable
          : typeof data.quantity === 'number'
            ? data.quantity
            : null

      return {
        id: productDoc.id,
        name: (typeof data.name === 'string' && data.name.trim()) || productDoc.id,
        sellerId,
        sellerName:
          (typeof data.sellerName === 'string' && data.sellerName.trim()) ||
          usersMap.get(sellerId) ||
          'Unknown seller',
        moderationStatus: moderationStatus.toUpperCase(),
        price: typeof data.price === 'number' ? data.price : null,
        quantityAvailable,
        description:
          (typeof data.description === 'string' && data.description.trim()) ||
          (typeof data.productDetail === 'string' && data.productDetail.trim()) ||
          '',
        category:
          (typeof data.category === 'string' && data.category.trim()) ||
          (typeof data.categoryName === 'string' && data.categoryName.trim()) ||
          '',
        createdAt: toMillis(data.createdAt),
        imageUrls
      }
    })

    const reports: ReportItem[] = reportsSnapshot.docs.map((reportDoc) => {
      const data = reportDoc.data()
      const rawTargetType = typeof data.targetType === 'string' ? data.targetType : 'PRODUCT'
      const type: ReportItem['type'] =
        rawTargetType === 'SELLER'
          ? 'User'
          : rawTargetType === 'CONVERSATION'
            ? 'Conversation'
            : 'Product'

      const rawStatus = typeof data.status === 'string' ? data.status.toUpperCase() : 'OPEN'
      const status: ReportItem['status'] = rawStatus === 'RESOLVED' ? 'Resolved' : 'Pending'

      const reporterId = typeof data.reporterId === 'string' ? data.reporterId : ''
      const reporter = usersMap.get(reporterId) || reporterId || 'Unknown user'

      const reason =
        (typeof data.reasonLabel === 'string' && data.reasonLabel.trim()) ||
        (typeof data.reasonCode === 'string' &&
          data.reasonCode.replace(/_/g, ' ').toLowerCase()) ||
        'No reason'

      return {
        id: reportDoc.id,
        type,
        reporter,
        reason,
        details:
          (typeof data.description === 'string' && data.description.trim()) ||
          'No details provided.',
        status,
        createdAt: toMillis(data.createdAt)
      }
    })

    const activeReports = reports.filter((item) => item.status === 'Pending').length
    const pendingVerifications = products.filter(
      (item) => item.moderationStatus === 'PENDING'
    ).length

    const todaySales = await this.fetchTodaySales()
    const payouts = await this.fetchPendingPayouts(usersMap)

    return {
      stats: {
        ...defaultDashboardStats,
        totalUsers: users.length,
        pendingVerifications,
        activeReports,
        todaySales
      },
      reports,
      payouts,
      users,
      products
    }
  }

  async resolveReport(reportId: string): Promise<void> {
    await updateDoc(doc(db, 'reports', reportId), {
      status: 'RESOLVED',
      resolvedAt: serverTimestamp(),
      resolvedBy: auth.currentUser?.uid || ''
    })
  }

  async approvePayout(payoutId: string): Promise<void> {
    await updateDoc(doc(db, 'payoutRequests', payoutId), {
      status: 'APPROVED',
      approvedAt: serverTimestamp(),
      approvedBy: auth.currentUser?.uid || ''
    })
  }

  async saveProduct(input: ProductSaveInput): Promise<ProductItem> {
    const name = input.form.name.trim()
    const sellerId = input.form.sellerId.trim()
    const sellerName = input.form.sellerName.trim() || 'Unknown seller'
    const status = (input.form.moderationStatus.trim() || 'PENDING').toUpperCase()
    const description = input.form.description.trim()
    const category = input.form.category.trim()
    const imageUrl = input.form.imageUrl.trim()
    const price = toNumberOrNull(input.form.price.trim())
    const quantityAvailable = toNumberOrNull(input.form.quantityAvailable.trim())

    const payload: Record<string, unknown> = {
      name,
      userId: sellerId,
      sellerId,
      sellerName: input.form.sellerName.trim(),
      moderationStatus: status,
      status,
      description,
      category,
      categoryName: category,
      updatedAt: serverTimestamp()
    }

    if (price != null) payload.price = price
    if (quantityAvailable != null) payload.quantityAvailable = quantityAvailable
    if (imageUrl) payload.imageUrls = [imageUrl]

    let id = input.productId ?? ''
    if (input.mode === 'create') {
      payload.createdAt = serverTimestamp()
      const created = await addDoc(collection(db, 'products'), payload)
      id = created.id
    } else {
      if (!input.productId) {
        throw new Error('Missing product id.')
      }
      await updateDoc(doc(db, 'products', input.productId), payload)
      id = input.productId
    }

    return {
      id,
      name,
      sellerId,
      sellerName,
      moderationStatus: status,
      price,
      quantityAvailable,
      description,
      category,
      createdAt: Date.now(),
      imageUrls: imageUrl ? [imageUrl] : []
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    await deleteDoc(doc(db, 'products', productId))
  }

  async setUserLock(userId: string, disabled: boolean): Promise<void> {
    const idToken = await this.getIdToken()
    await this.adminApiClient.setUserLock(userId, disabled, idToken)
  }

  async deleteUser(userId: string): Promise<void> {
    const idToken = await this.getIdToken()
    await this.adminApiClient.deleteUser(userId, idToken)
  }

  mapSignInError(error: unknown): string {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          return 'Email or password is incorrect.'
        case 'auth/too-many-requests':
          return 'Too many failed attempts. Please try again later.'
        default:
          return error.message || 'Unable to sign in.'
      }
    }
    return 'Unable to sign in.'
  }

  mapActionError(error: unknown): string {
    if (error instanceof TypeError && /fetch/i.test(error.message)) {
      return `Cannot reach admin API at ${getAdminApiBaseUrl()}. Check backend is running and VITE_ADMIN_API_BASE_URL is correct.`
    }
    return error instanceof Error ? error.message : 'Request failed.'
  }

  private async fetchTodaySales(): Promise<number | null> {
    try {
      const ordersSnapshot = await getDocs(
        query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(300))
      )
      const now = new Date()
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).getTime()

      return ordersSnapshot.docs.reduce((total, orderDoc) => {
        const data = orderDoc.data()
        const createdAt = toMillis(data.createdAt)
        if (createdAt < startOfToday) return total
        const status = typeof data.status === 'string' ? data.status : ''
        if (status === 'CANCELLED') return total
        const orderTotal = typeof data.total === 'number' ? data.total : 0
        return total + orderTotal
      }, 0)
    } catch {
      return null
    }
  }

  private async fetchPendingPayouts(usersMap: Map<string, string>) {
    try {
      const payoutSnapshot = await getDocs(
        query(collection(db, 'payoutRequests'), orderBy('createdAt', 'desc'), limit(15))
      )
      return payoutSnapshot.docs
        .map((payoutDoc) => {
          const data = payoutDoc.data()
          const sellerId = typeof data.sellerId === 'string' ? data.sellerId : ''
          const seller = usersMap.get(sellerId) || sellerId || 'Unknown seller'
          const amount = typeof data.amount === 'number' ? data.amount : 0
          const status = typeof data.status === 'string' ? data.status.toUpperCase() : 'PENDING'
          return {
            id: payoutDoc.id,
            seller,
            amount: toPayoutMoney(amount),
            status
          }
        })
        .filter((item) => item.status === 'PENDING')
    } catch {
      return []
    }
  }
}
