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
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore'
import {
  DashboardData,
  OrderAddress,
  OrderItem,
  OrderPaymentMethodDetails,
  ProductModerationAction,
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
  return amount.toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

function toNumberOrNull(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toNumberOrNullFromUnknown(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, itemValue]) => {
      if (typeof itemValue === 'string' && itemValue.trim()) {
        acc[key] = itemValue.trim()
      }
      return acc
    },
    {}
  )
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => toStringOrEmpty(item))
    .filter((item) => item.length > 0)
}

function firstStringFromList(value: unknown): string {
  return Array.isArray(value)
    ? value.map((item) => toStringOrEmpty(item)).find((item) => item.length > 0) ?? ''
    : ''
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function firstString(
  data: Record<string, unknown>,
  nested: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const direct = toStringOrEmpty(data[key])
    if (direct) return direct
    const nestedValue = toStringOrEmpty(nested[key])
    if (nestedValue) return nestedValue
  }
  return ''
}

function firstNumber(
  data: Record<string, unknown>,
  nested: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const direct = toNumberOrNullFromUnknown(data[key])
    if (direct != null) return direct
    const nestedValue = toNumberOrNullFromUnknown(nested[key])
    if (nestedValue != null) return nestedValue
  }
  return null
}

function firstMillis(
  data: Record<string, unknown>,
  nested: Record<string, unknown>,
  ...keys: string[]
): number {
  for (const key of keys) {
    const direct = toMillis(data[key])
    if (direct > 0) return direct
    const nestedValue = toMillis(nested[key])
    if (nestedValue > 0) return nestedValue
  }
  return 0
}

function toOrderAddress(value: unknown): OrderAddress | null {
  const map = toRecord(value)
  const recipientName = toStringOrEmpty(map.recipientName)
  const phoneNumber = toStringOrEmpty(map.phoneNumber)
  const addressLine = toStringOrEmpty(map.addressLine)
  if (!recipientName && !phoneNumber && !addressLine) return null

  return {
    id: toStringOrEmpty(map.id),
    recipientName,
    phoneNumber,
    addressLine,
    isDefault: map.isDefault === true
  }
}

function toOrderPaymentMethodDetails(value: unknown): OrderPaymentMethodDetails | null {
  const map = toRecord(value)
  const type = toStringOrEmpty(map.type)
  const label = toStringOrEmpty(map.label)
  const accountName = toStringOrEmpty(map.accountName)
  const accountNumber = toStringOrEmpty(map.accountNumber)
  const bankCode = toStringOrEmpty(map.bankCode)
  const bankName = toStringOrEmpty(map.bankName)
  const phoneNumber = toStringOrEmpty(map.phoneNumber)
  const note = toStringOrEmpty(map.note)
  if (!type && !label && !accountName && !accountNumber && !phoneNumber) return null

  return {
    type,
    label,
    accountName,
    accountNumber,
    bankCode,
    bankName,
    phoneNumber,
    note
  }
}

function normalizeOrderStatus(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[-\s]+/g, '_')
  if (!normalized) return 'UNKNOWN'
  if (['WAIT_PAYMENT', 'WAITING_PAYMENT', 'WAIT_FOR_PAYMENT', 'PENDING_PAYMENT', 'AWAITING_PAYMENT'].includes(normalized)) {
    return 'WAITING_PAYMENT'
  }
  if (['WAIT_CONFIRMATION', 'WAITING', 'WAITING_CONFIRMATION', 'WAIT_FOR_CONFIRMATION', 'CONFIRMED', 'PENDING', 'PENDING_CONFIRMATION'].includes(normalized)) {
    return 'WAITING_CONFIRMATION'
  }
  if (['WAIT_PICKUP', 'WAITING_PICKUP', 'WAIT_FOR_PICKUP', 'READY_FOR_PICKUP', 'PICKUP_READY'].includes(normalized)) {
    return 'WAITING_PICKUP'
  }
  if (['SHIPPING', 'SHIPPED'].includes(normalized)) return 'SHIPPING'
  if (normalized === 'IN_TRANSIT') return 'IN_TRANSIT'
  if (normalized === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY'
  if (['DELIVERED', 'COMPLETED', 'SUCCESS'].includes(normalized)) return 'DELIVERED'
  if (['CANCELLED', 'CANCELED', 'FAILED'].includes(normalized)) return 'CANCELLED'
  return 'UNKNOWN'
}

function toProductCategory(data: Record<string, unknown>): string {
  const directCategory = toStringOrEmpty(data.category)
  if (directCategory) return directCategory

  const categoryName = toStringOrEmpty(data.categoryName)
  if (categoryName) return categoryName

  const categoryId = toStringOrEmpty(data.categoryId)
  if (categoryId) return categoryId

  return ''
}

function toSellerPickupAddress(
  value: unknown
): {
  id: string
  recipientName: string
  phoneNumber: string
  addressLine: string
  isDefault: boolean
} | null {
  if (!value || typeof value !== 'object') return null
  const map = value as Record<string, unknown>
  const recipientName = toStringOrEmpty(map.recipientName)
  const phoneNumber = toStringOrEmpty(map.phoneNumber)
  const addressLine = toStringOrEmpty(map.addressLine)
  if (!recipientName && !phoneNumber && !addressLine) return null

  return {
    id: toStringOrEmpty(map.id),
    recipientName,
    phoneNumber,
    addressLine,
    isDefault: map.isDefault === true
  }
}

function maskSuffix(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 4) return trimmed
  return `••••${trimmed.slice(-4)}`
}

function toReceiverAccountLabel(value: unknown): string {
  const map = value as Record<string, unknown> | null
  if (!map || typeof map !== 'object') return ''
  const type = toStringOrEmpty(map.type).toUpperCase()
  const label = toStringOrEmpty(map.label)
  const bankName = toStringOrEmpty(map.bankName)
  const accountNumber = toStringOrEmpty(map.accountNumber)
  const phoneNumber = toStringOrEmpty(map.phoneNumber)

  if (type === 'BANK_TRANSFER') {
    const title = label || bankName || 'Bank transfer'
    const suffix = accountNumber ? maskSuffix(accountNumber) : ''
    return [title, suffix].filter(Boolean).join(' • ')
  }
  if (type === 'MOMO') {
    return `MoMo • ${maskSuffix(phoneNumber)}`
  }
  return label
}

function toReceiverMethod(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {}
  return value as Record<string, unknown>
}

function parseSpecificationsRows(
  rows: Array<{ key: string; value: string }>
): Record<string, string> {
  return rows.reduce<Record<string, string>>((acc, row) => {
    const key = row.key.trim()
    const value = row.value.trim()
    if (key && value) {
      acc[key] = value
    }
    return acc
  }, {})
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
    const [usersSnapshot, productsSnapshot, ordersSnapshot, reportsSnapshot] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'products')),
      getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(500))),
      getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(25)))
    ])

    const users: UserItem[] = usersSnapshot.docs.map((userDoc) => {
      const data = userDoc.data()
      const accountStatus =
        typeof data.accountStatus === 'string' ? data.accountStatus.toUpperCase() : ''
      const avatarUrl =
        toStringOrEmpty(data.avatarUrl) ||
        toStringOrEmpty(data.photoURL) ||
        toStringOrEmpty(data.photoUrl) ||
        toStringOrEmpty(data.profileImageUrl) ||
        toStringOrEmpty(data.profilePicture) ||
        toStringOrEmpty(data.imageUrl)
      const phoneNumber =
        toStringOrEmpty(data.phoneNumber) ||
        toStringOrEmpty(data.phone) ||
        toStringOrEmpty(data.mobilePhone)
      const walletBalance =
        toNumberOrNullFromUnknown(data.walletBalance) ??
        toNumberOrNullFromUnknown(data.balance) ??
        toNumberOrNullFromUnknown(data.wallet)
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
        phoneNumber,
        avatarUrl,
        university: toStringOrEmpty(data.university),
        studentId: toStringOrEmpty(data.studentId),
        walletBalance,
        boughtCount: toNumberOrNullFromUnknown(data.boughtCount),
        soldCount: toNumberOrNullFromUnknown(data.soldCount),
        averageRating: toNumberOrNullFromUnknown(data.averageRating),
        ratingCount: toNumberOrNullFromUnknown(data.ratingCount),
        isLocked
      }
    })

    const usersMap = new Map<string, string>()
    const userPhoneMap = new Map<string, string>()
    users.forEach((item) => usersMap.set(item.id, item.name))
    users.forEach((item) => userPhoneMap.set(item.id, item.phoneNumber))

    const orders: OrderItem[] = ordersSnapshot.docs.map((orderDoc) => {
      const data = orderDoc.data()
      const productMap = toRecord(data.product)
      const sellerMap = toRecord(data.seller)
      const quantity = Math.max(1, Math.trunc(firstNumber(data, productMap, 'quantity', 'itemCount') ?? 1))
      const unitPrice = firstNumber(data, productMap, 'unitPrice', 'price', 'productPrice') ?? 0
      const totalAmount =
        firstNumber(data, productMap, 'totalAmount', 'totalPrice', 'orderTotal', 'total', 'amount') ??
        unitPrice * quantity
      const buyerId =
        firstString(data, {}, 'buyerId', 'buyerUid') ||
        toStringOrEmpty((orderDoc.ref.parent.parent as { id?: unknown } | null)?.id)
      const sellerId = firstString(data, sellerMap, 'sellerId', 'sellerUid', 'userId')
      const rawStatus = firstString(data, {}, 'status', 'orderStatus')
      const status = normalizeOrderStatus(rawStatus)
      const statusLabel = toStringOrEmpty(data.statusLabel) || rawStatus || status

      return {
        id: orderDoc.id,
        buyerId,
        buyerName: firstString(data, {}, 'buyerName', 'buyerDisplayName') || usersMap.get(buyerId) || buyerId || '-',
        buyerPhoneNumber: userPhoneMap.get(buyerId) || '',
        sellerId,
        sellerName:
          firstString(data, sellerMap, 'storeName', 'sellerName', 'sellerDisplayName') ||
          usersMap.get(sellerId) ||
          sellerId ||
          '-',
        sellerPhoneNumber: userPhoneMap.get(sellerId) || '',
        productId: firstString(data, productMap, 'productId', 'id'),
        productName: firstString(data, productMap, 'productName', 'name') || 'Purchased Item',
        productDetail: firstString(
          data,
          productMap,
          'productDetail',
          'productSubtitle',
          'productDescription',
          'description',
          'condition'
        ),
        productImageUrl:
          firstString(data, productMap, 'productImageUrl', 'imageUrl', 'thumbnailUrl') ||
          firstStringFromList(data.imageUrls) ||
          firstStringFromList(productMap.imageUrls),
        quantity,
        unitPrice,
        totalAmount,
        deliveryMethod: firstString(data, {}, 'deliveryMethod'),
        paymentMethod: firstString(data, {}, 'paymentMethod'),
        paymentMethodDetails: toOrderPaymentMethodDetails(data.paymentMethodDetails),
        meetingPoint: firstString(data, {}, 'meetingPoint'),
        buyerAddress: toOrderAddress(data.buyerAddress),
        sellerAddress: toOrderAddress(data.sellerAddress),
        transferContent: firstString(data, {}, 'transferContent'),
        paymentExpiresAt: firstMillis(data, {}, 'paymentExpiresAt'),
        paymentConfirmedAt: firstMillis(data, {}, 'paymentConfirmedAt'),
        status,
        statusLabel,
        createdAt: firstMillis(data, productMap, 'createdAt', 'orderedAt'),
        updatedAt: firstMillis(data, productMap, 'updatedAt', 'lastUpdatedAt', 'statusUpdatedAt')
      }
    })

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
      const fallbackImageUrl = toStringOrEmpty(data.imageUrl)
      const normalizedImageUrls =
        imageUrls.length > 0 ? imageUrls : fallbackImageUrl ? [fallbackImageUrl] : []
      const quantityAvailable =
        typeof data.quantityAvailable === 'number'
          ? data.quantityAvailable
          : typeof data.quantity === 'number'
            ? data.quantity
            : null
      const createdAt = toMillis(data.createdAt)
      const postedAt = toMillis(data.postedAt)

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
        category: toProductCategory(data as Record<string, unknown>),
        condition: toStringOrEmpty(data.condition),
        createdAt: postedAt || createdAt,
        imageUrls: normalizedImageUrls,
        specifications: toStringRecord(data.specifications),
        deliveryMethodsAvailable: toStringList(data.deliveryMethodsAvailable),
        sellerPickupAddress: toSellerPickupAddress(data.sellerPickupAddress)
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
    const payouts = await this.fetchPayoutRequests(usersMap)

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
      orders,
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
    const currentAdminId = auth.currentUser?.uid || ''
    const nextStatus = 'APPROVED'
    const payoutRef = doc(db, 'payoutRequests', payoutId)
    const payoutSnapshot = await getDoc(payoutRef)
    if (!payoutSnapshot.exists()) {
      throw new Error('Payout request not found.')
    }

    const payoutData = payoutSnapshot.data()
    const receiverId =
      (typeof payoutData.sellerId === 'string' && payoutData.sellerId.trim()) ||
      (typeof payoutData.requesterId === 'string' && payoutData.requesterId.trim()) ||
      ''
    const amount = typeof payoutData.amount === 'number' ? payoutData.amount : 0
    const currency =
      (typeof payoutData.currency === 'string' && payoutData.currency.trim()) || 'VND'
    const receiverMethod = payoutData.receiverMethod
    const receiverMethodId =
      typeof payoutData.receiverMethodId === 'string' ? payoutData.receiverMethodId : ''
    const receiverMethodType =
      typeof payoutData.receiverMethodType === 'string' ? payoutData.receiverMethodType : ''
    const receiverMethodLabel =
      typeof payoutData.receiverMethodLabel === 'string' ? payoutData.receiverMethodLabel : ''
    const receiverMethodSubtitle =
      typeof payoutData.receiverMethodSubtitle === 'string' ? payoutData.receiverMethodSubtitle : ''
    const previousStatus =
      typeof payoutData.status === 'string' ? payoutData.status.toUpperCase() : 'PENDING'

    await runTransaction(db, async (transaction) => {
      const freshPayout = await transaction.get(payoutRef)
      if (!freshPayout.exists()) {
        throw new Error('Payout request not found.')
      }

      const freshData = freshPayout.data()
      const freshStatus =
        typeof freshData.status === 'string' ? freshData.status.toUpperCase() : 'PENDING'
      const shouldCreateNotification = freshStatus !== nextStatus
      const walletTxRef = receiverId
        ? doc(db, 'users', receiverId, 'walletTransactions', `withdraw_${payoutId}`)
        : null
      const walletTxSnapshot = walletTxRef ? await transaction.get(walletTxRef) : null

      transaction.update(payoutRef, {
        status: nextStatus,
        approvedAt: serverTimestamp(),
        approvedBy: currentAdminId,
        updatedAt: serverTimestamp()
      })

      if (!receiverId) return

      if (walletTxRef != null && walletTxSnapshot?.exists()) {
        transaction.update(walletTxRef, {
          status: nextStatus,
          updatedAt: serverTimestamp(),
          source: 'WEB_ADMIN'
        })
      } else if (walletTxRef != null) {
        transaction.set(walletTxRef, {
          type: 'WITHDRAW',
          payoutRequestId: payoutId,
          amount,
          currency,
          status: nextStatus,
          title: 'Wallet withdrawal',
          receiverMethod,
          receiverMethodId,
          receiverMethodType,
          receiverMethodLabel,
          receiverMethodSubtitle,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          source: 'WEB_ADMIN'
        })
      }

      if (shouldCreateNotification) {
        const notificationRef = doc(collection(db, 'users', receiverId, 'notifications'))
        transaction.set(notificationRef, {
          title: 'Cap nhat lenh rut tien',
          body: `Lenh rut ${amount.toLocaleString('vi-VN')} ${currency} da chuyen sang trang thai ${nextStatus}.`,
          type: 'payout_request',
          payoutRequestId: payoutId,
          status: nextStatus,
          previousStatus,
          amount,
          currency,
          isRead: false,
          createdAt: serverTimestamp(),
          receiverId,
          source: 'WEB_ADMIN'
        })
      }
    })
  }

  async saveProduct(input: ProductSaveInput): Promise<ProductItem> {
    const name = input.form.name.trim()
    const sellerId = input.form.sellerId.trim()
    const sellerName = input.form.sellerName.trim() || 'Unknown seller'
    const status = (input.form.moderationStatus.trim() || 'PENDING').toUpperCase()
    const description = input.form.description.trim()
    const category = input.form.category.trim()
    const condition = input.form.condition.trim()
    const specifications = parseSpecificationsRows(input.form.specifications)
    const price = toNumberOrNull(input.form.price.trim())
    const quantityAvailable = toNumberOrNull(input.form.quantityAvailable.trim())
    const imageUrls = input.form.imageUrlsText
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
    const deliveryMethodsAvailable = input.form.deliveryMethodsAvailable
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
    const isBuyerPickupEnabled = deliveryMethodsAvailable.includes('BUYER_TO_SELLER')
    const pickupAddressRecipientName = input.form.pickupAddressRecipientName.trim()
    const pickupAddressPhoneNumber = input.form.pickupAddressPhoneNumber.trim()
    const pickupAddressLine = input.form.pickupAddressLine.trim()
    const sellerPickupAddress =
      isBuyerPickupEnabled && (pickupAddressRecipientName || pickupAddressPhoneNumber || pickupAddressLine)
        ? {
            id: '',
            recipientName: pickupAddressRecipientName,
            phoneNumber: pickupAddressPhoneNumber,
            addressLine: pickupAddressLine,
            isDefault: false
          }
        : null

    const payload: Record<string, unknown> = {
      name,
      userId: sellerId,
      sellerId,
      sellerName: input.form.sellerName.trim(),
      rating: 0,
      location: 'Unknown',
      timeAgo: '',
      isFavorite: false,
      moderationStatus: status,
      status,
      isVisible: status === 'APPROVED',
      description,
      specifications,
      category,
      categoryName: category,
      categoryId: category,
      condition,
      deliveryMethodsAvailable,
      sellerPickupAddress,
      updatedAt: serverTimestamp()
    }

    if (price != null) payload.price = price
    if (quantityAvailable != null) payload.quantityAvailable = quantityAvailable
    if (imageUrls.length > 0) payload.imageUrls = imageUrls

    let id = input.productId ?? ''
    if (input.mode === 'create') {
      payload.createdAt = serverTimestamp()
      payload.postedAt = serverTimestamp()
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
      condition,
      createdAt: Date.now(),
      imageUrls,
      specifications,
      deliveryMethodsAvailable,
      sellerPickupAddress
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    await deleteDoc(doc(db, 'products', productId))
  }

  async moderateProduct(
    productId: string,
    action: ProductModerationAction,
    reason = ''
  ): Promise<void> {
    const idToken = await this.getIdToken()
    await this.adminApiClient.moderateProduct(productId, action, reason.trim(), idToken)
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
        const productMap = toRecord(data.product)
        const createdAt = toMillis(data.createdAt)
        if (createdAt < startOfToday) return total
        const status = normalizeOrderStatus(toStringOrEmpty(data.status))
        if (status === 'CANCELLED') return total
        const orderTotal =
          firstNumber(data, productMap, 'totalAmount', 'totalPrice', 'orderTotal', 'total', 'amount') ?? 0
        return total + orderTotal
      }, 0)
    } catch {
      return null
    }
  }

  private async fetchPayoutRequests(usersMap: Map<string, string>) {
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
          const receiverMethod = toReceiverMethod(data.receiverMethod)
          const receiverMethodType =
            toStringOrEmpty(receiverMethod.type) || toStringOrEmpty(data.receiverMethodType)
          const receiverBankCode =
            toStringOrEmpty(receiverMethod.bankCode) || toStringOrEmpty(data.receiverMethodBankCode)
          const receiverBankName =
            toStringOrEmpty(receiverMethod.bankName) || toStringOrEmpty(data.receiverMethodBankName)
          const receiverAccountName =
            toStringOrEmpty(receiverMethod.accountName) || toStringOrEmpty(data.receiverMethodAccountName)
          const receiverAccountNumber =
            toStringOrEmpty(receiverMethod.accountNumber) || toStringOrEmpty(data.receiverMethodAccountNumber)
          const receiverPhoneNumber =
            toStringOrEmpty(receiverMethod.phoneNumber) || toStringOrEmpty(data.receiverMethodPhoneNumber)
          const receiverAccountFromObject = toReceiverAccountLabel(receiverMethod)
          const receiverAccount =
            receiverAccountFromObject ||
            toStringOrEmpty(data.receiverMethodSubtitle) ||
            toStringOrEmpty(data.receiverMethodLabel) ||
            '-'
          return {
            id: payoutDoc.id,
            seller,
            amount: toPayoutMoney(amount),
            amountValue: amount,
            createdAt: toMillis(data.createdAt),
            status,
            receiverAccount,
            receiverMethodType,
            receiverBankCode,
            receiverBankName,
            receiverAccountName,
            receiverAccountNumber,
            receiverPhoneNumber
          }
        })
    } catch {
      return []
    }
  }
}
