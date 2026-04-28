export type ReportStatus = 'Pending' | 'Resolved'

export type ScreenKey =
  | 'dashboard'
  | 'users'
  | 'orders'
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
  createdAt: number
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
  phoneNumber: string
  avatarUrl: string
  university: string
  studentId: string
  walletBalance: number | null
  boughtCount: number | null
  soldCount: number | null
  averageRating: number | null
  ratingCount: number | null
  isLocked: boolean
}

export type OrderAddress = {
  id: string
  recipientName: string
  phoneNumber: string
  addressLine: string
  isDefault: boolean
}

export type OrderPaymentMethodDetails = {
  type: string
  label: string
  accountName: string
  accountNumber: string
  bankCode: string
  bankName: string
  phoneNumber: string
  note: string
}

export type OrderItem = {
  id: string
  buyerId: string
  buyerName: string
  buyerPhoneNumber: string
  sellerId: string
  sellerName: string
  sellerPhoneNumber: string
  productId: string
  productName: string
  productDetail: string
  productImageUrl: string
  quantity: number
  unitPrice: number
  totalAmount: number
  deliveryMethod: string
  paymentMethod: string
  paymentMethodDetails: OrderPaymentMethodDetails | null
  meetingPoint: string
  buyerAddress: OrderAddress | null
  sellerAddress: OrderAddress | null
  transferContent: string
  paymentExpiresAt: number
  paymentConfirmedAt: number
  status: string
  statusLabel: string
  createdAt: number
  updatedAt: number
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
  condition: string
  createdAt: number
  imageUrls: string[]
  specifications: Record<string, string>
  deliveryMethodsAvailable: string[]
  sellerPickupAddress: {
    id: string
    recipientName: string
    phoneNumber: string
    addressLine: string
    isDefault: boolean
  } | null
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
  condition: string
  deliveryMethodsAvailable: string[]
  pickupAddressRecipientName: string
  pickupAddressPhoneNumber: string
  pickupAddressLine: string
  imageUrlsText: string
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
  condition: '',
  deliveryMethodsAvailable: [],
  pickupAddressRecipientName: '',
  pickupAddressPhoneNumber: '',
  pickupAddressLine: '',
  imageUrlsText: ''
}

export type DashboardData = {
  stats: DashboardStats
  reports: ReportItem[]
  payouts: PayoutItem[]
  users: UserItem[]
  orders: OrderItem[]
  products: ProductItem[]
}

export type ProductSaveInput = {
  mode: ProductFormMode
  productId?: string
  form: ProductFormState
}
