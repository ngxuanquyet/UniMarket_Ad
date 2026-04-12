export type ReportStatus = 'Pending' | 'Resolved'

export type ScreenKey =
  | 'dashboard'
  | 'users'
  | 'products'
  | 'reports'
  | 'payouts'
  | 'settings'

export type ReportItem = {
  id: string
  type: 'Product' | 'User' | 'Conversation'
  reporter: string
  reason: string
  details: string
  status: ReportStatus
  createdAt: number
}

export type PayoutItem = {
  id: string
  seller: string
  amount: string
  amountValue: number
  status: string
  receiverAccount: string
  receiverMethodType: string
  receiverBankCode: string
  receiverBankName: string
  receiverAccountName: string
  receiverAccountNumber: string
  receiverPhoneNumber: string
}

export type UserItem = {
  id: string
  name: string
  email: string
  avatarUrl: string
  walletBalance: number | null
  isLocked: boolean
}

export type ProductItem = {
  id: string
  name: string
  sellerId: string
  sellerName: string
  moderationStatus: string
  price: number | null
  quantityAvailable: number | null
  description: string
  category: string
  createdAt: number
  imageUrls: string[]
  specifications: Record<string, string>
}

export type ProductFormMode = 'create' | 'edit'
export type ProductModerationAction = 'APPROVE' | 'REJECT' | 'DISABLE' | 'ENABLE'
export type ProductSpecificationField = {
  key: string
  value: string
}

export type ProductFormState = {
  name: string
  sellerId: string
  sellerName: string
  moderationStatus: string
  price: string
  quantityAvailable: string
  description: string
  specifications: ProductSpecificationField[]
  category: string
  imageUrl: string
}

export type DashboardStats = {
  totalUsers: number
  pendingVerifications: number
  activeReports: number
  todaySales: number | null
}

export type AuthScreenState = 'checking' | 'logged_out' | 'authenticated'

export const defaultDashboardStats: DashboardStats = {
  totalUsers: 0,
  pendingVerifications: 0,
  activeReports: 0,
  todaySales: null
}

export const defaultProductFormState: ProductFormState = {
  name: '',
  sellerId: '',
  sellerName: '',
  moderationStatus: 'PENDING',
  price: '',
  quantityAvailable: '',
  description: '',
  specifications: [{ key: '', value: '' }],
  category: '',
  imageUrl: ''
}

export type DashboardData = {
  stats: DashboardStats
  reports: ReportItem[]
  payouts: PayoutItem[]
  users: UserItem[]
  products: ProductItem[]
}

export type ProductSaveInput = {
  mode: ProductFormMode
  productId?: string
  form: ProductFormState
}
