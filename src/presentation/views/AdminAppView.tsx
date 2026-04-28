import { useEffect, useState } from 'react'
import { AdminController } from '../controllers/useAdminController'
import { OrderItem, PayoutItem, ProductItem, ScreenKey } from '../../domain/entities/admin'
import { formatDateTime, toMoney } from '../utils/format'

type Props = {
  controller: AdminController
  themeMode: 'light' | 'dark'
  onToggleTheme: () => void
}

const menuItems: Array<{ key: ScreenKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'User Management' },
  { key: 'orders', label: 'Order Management' },
  { key: 'products', label: 'Product Moderation' },
  { key: 'reports', label: 'Reported Content' },
  { key: 'payouts', label: 'Payout Requests' },
  { key: 'settings', label: 'Settings' }
]

function getDisplayInitial(name: string): string {
  const normalized = name.trim()
  if (!normalized) return 'U'
  return normalized.charAt(0).toUpperCase()
}

type WalletCurrency = 'USD' | 'VND'
type ModerationFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED'
type OrderStatusFilter =
  | 'ALL'
  | 'WAITING_PAYMENT'
  | 'WAITING_CONFIRMATION'
  | 'WAITING_PICKUP'
  | 'SHIPPING'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'UNKNOWN'
const DEFAULT_USD_TO_VND_RATE = 26000
const USD_TO_VND_RATE =
  Number.isFinite(Number(import.meta.env.VITE_USD_TO_VND_RATE)) &&
  Number(import.meta.env.VITE_USD_TO_VND_RATE) > 0
    ? Number(import.meta.env.VITE_USD_TO_VND_RATE)
    : DEFAULT_USD_TO_VND_RATE
const PRODUCT_CATEGORIES = ['Electronics', 'Textbooks', 'Furniture', 'Clothing', 'Other'] as const
const PRODUCT_CONDITIONS = ['New', 'Like New', 'Good', 'Fair'] as const
const DELIVERY_METHODS = [
  { value: 'DIRECT_MEET', label: 'Direct meet' },
  { value: 'BUYER_TO_SELLER', label: 'Buyer pickup at seller address' },
  { value: 'SELLER_TO_BUYER', label: 'Seller delivers to buyer' },
  { value: 'SHIPPING', label: 'Shipping service' }
] as const

function formatWalletBalance(amount: number | null, currency: WalletCurrency): string {
  if (amount == null) return '--'
  if (currency === 'VND') {
    return amount.toLocaleString('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    })
  }
  const usdAmount = amount / USD_TO_VND_RATE
  return usdAmount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatPriceFromVnd(amount: number | null, currency: WalletCurrency): string {
  if (amount == null) return '--'
  if (currency === 'VND') {
    return amount.toLocaleString('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    })
  }
  const usdAmount = amount / USD_TO_VND_RATE
  return usdAmount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function buildPayoutQrUrl(payout: PayoutItem): string | null {
  if (payout.receiverMethodType.toUpperCase() !== 'BANK_TRANSFER') return null
  const bankCode = payout.receiverBankCode.trim().toUpperCase()
  const accountNumber = payout.receiverAccountNumber.trim().replace(/\s+/g, '')
  if (!bankCode || !accountNumber) return null

  const params = new URLSearchParams()
  if (Number.isFinite(payout.amountValue) && payout.amountValue > 0) {
    params.set('amount', String(Math.round(payout.amountValue)))
  }
  params.set('addInfo', `RUT ${payout.id.slice(-8).toUpperCase()}`)
  if (payout.receiverAccountName.trim()) {
    params.set('accountName', payout.receiverAccountName.trim())
  }

  return `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(accountNumber)}-compact2.png?${params.toString()}`
}

function formatOrderAddress(address: OrderItem['buyerAddress']): string {
  if (!address) return '-'
  return [address.recipientName, address.phoneNumber, address.addressLine].filter(Boolean).join(' | ') || '-'
}

function formatOrderPaymentDetails(order: OrderItem): string {
  const details = order.paymentMethodDetails
  if (!details) return order.paymentMethod || '-'
  const label = details.label || details.type || order.paymentMethod
  const bank = [details.bankName, details.accountName, details.accountNumber].filter(Boolean).join(' | ')
  const phone = details.phoneNumber ? `Phone: ${details.phoneNumber}` : ''
  return [label, bank, phone].filter(Boolean).join(' | ') || '-'
}

export function AdminAppView({ controller, themeMode, onToggleTheme }: Props) {
  const [walletCurrency, setWalletCurrency] = useState<WalletCurrency>('VND')

  if (controller.authScreenState !== 'authenticated') {
    return (
      <main className="page login-page">
        <div className="bg-lines" />
        <section className="login-card">
          <header className="login-header">
            <div className="brand-row">
              <img className="brand-logo" src="/icon_unimarket.png" alt="UniMarket logo" />
              <h1>UniMarket Admin</h1>
            </div>
            <button type="button" className="theme-toggle-btn" onClick={onToggleTheme}>
              {themeMode === 'dark' ? 'Light' : 'Dark'}
            </button>
          </header>

          {controller.authScreenState === 'checking' ? (
            <div className="loading-box">Checking admin session...</div>
          ) : (
            <form onSubmit={controller.handleLogin} className="login-form">
              <label>
                Email Address
                <input
                  type="text"
                  placeholder="name@example.com"
                  value={controller.email}
                  onChange={(e) => controller.setEmail(e.target.value)}
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={controller.password}
                  onChange={(e) => controller.setPassword(e.target.value)}
                />
              </label>

              <div className="login-meta">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={controller.rememberMe}
                    onChange={(e) => controller.setRememberMe(e.target.checked)}
                  />
                  Remember me
                </label>
                <button type="button" className="link-btn">
                  Forgot Password?
                </button>
              </div>

              {controller.authError ? <p className="error-text">{controller.authError}</p> : null}

              <button type="submit" className="primary-btn" disabled={controller.isSubmitting}>
                {controller.isSubmitting ? 'Signing in...' : 'Login'}
              </button>
            </form>
          )}

          <p className="login-footnote">
            Authorized access only. By logging in, you agree to the UniMarket Admin terms of service.
          </p>
        </section>
      </main>
    )
  }

  const selectedUser = controller.selectedUser

  return (
    <main className="page dashboard-page">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img className="brand-logo" src="/icon_unimarket.png" alt="UniMarket logo" />
          <div>
            <p className="sidebar-brand-title">UniMarket</p>
            <p className="sidebar-brand-subtitle">Admin</p>
          </div>
        </div>

        <nav className="menu">
          {menuItems.map((item) => (
            <button
              key={item.key}
              className={`menu-item ${controller.activeScreen === item.key ? 'active' : ''}`}
              onClick={() => controller.setActiveScreen(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="content">
        <header className="content-header">
          <h2>Welcome back, {controller.adminEmail || 'Admin'}</h2>
          <div className="header-actions">
            <button type="button" className="theme-toggle-btn" onClick={onToggleTheme}>
              {themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <input
              className="search"
              placeholder={
                controller.activeScreen === 'users'
                  ? 'Search by name, user ID, email, phone number'
                  : controller.activeScreen === 'orders'
                    ? 'Search by order ID, buyer, seller, product, phone'
                  : controller.activeScreen === 'products'
                    ? 'Search by name, product ID, seller ID'
                    : 'Search'
              }
              value={controller.searchTerm}
              onChange={(e) => controller.setSearchTerm(e.target.value)}
            />
            <button className="logout-btn" onClick={controller.handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {controller.actionMessage ? (
          <div className="success-text" role="status" aria-live="polite">
            <span>{controller.actionMessage}</span>
            <button
              type="button"
              className="alert-close-btn"
              aria-label="Hide notification"
              onClick={() => controller.setActionMessage('')}
            >
              ×
            </button>
          </div>
        ) : null}

        {controller.isActionLoading ? (
          <div className="loading-box" role="status" aria-live="polite">
            Processing request...
          </div>
        ) : null}

        <ContentSection
          controller={controller}
          walletCurrency={walletCurrency}
          setWalletCurrency={setWalletCurrency}
        />
      </section>

      {controller.isProductFormOpen ? (
        <div className="modal-backdrop" onClick={controller.closeProductForm}>
          <div className="modal-card product-form-modal" onClick={(event) => event.stopPropagation()}>
            <h4>{controller.productFormMode === 'create' ? 'Add Product' : 'Edit Product'}</h4>
            <form className="product-form" onSubmit={controller.handleSaveProduct}>
              <label>
                Name
                <input
                  type="text"
                  value={controller.productForm.name}
                  onChange={(e) =>
                    controller.setProductForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Seller ID
                <input
                  type="text"
                  value={controller.productForm.sellerId}
                  onChange={(e) =>
                    controller.setProductForm((prev) => ({ ...prev, sellerId: e.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Seller Name
                <input
                  type="text"
                  value={controller.productForm.sellerName}
                  onChange={(e) =>
                    controller.setProductForm((prev) => ({ ...prev, sellerName: e.target.value }))
                  }
                />
              </label>
              <label>
                Status
                <select
                  value={controller.productForm.moderationStatus}
                  onChange={(e) =>
                    controller.setProductForm((prev) => ({
                      ...prev,
                      moderationStatus: e.target.value
                    }))
                  }
                >
                  <option value="PENDING">PENDING</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </label>
              <label>
                Price
                <input
                  type="number"
                  value={controller.productForm.price}
                  onChange={(e) =>
                    controller.setProductForm((prev) => ({ ...prev, price: e.target.value }))
                  }
                />
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  value={controller.productForm.quantityAvailable}
                  onChange={(e) =>
                    controller.setProductForm((prev) => ({
                      ...prev,
                      quantityAvailable: e.target.value
                    }))
                  }
                />
              </label>
              <label>
                Category
                <select
                  value={controller.productForm.category}
                  onChange={(e) =>
                    controller.setProductForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                >
                  <option value="">Select category</option>
                  {PRODUCT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  {controller.productForm.category &&
                  !PRODUCT_CATEGORIES.includes(
                    controller.productForm.category as (typeof PRODUCT_CATEGORIES)[number]
                  ) ? (
                    <option value={controller.productForm.category}>
                      {controller.productForm.category} (Current)
                    </option>
                  ) : null}
                </select>
              </label>
              <label>
                Condition
                <select
                  value={controller.productForm.condition}
                  onChange={(e) =>
                    controller.setProductForm((prev) => ({ ...prev, condition: e.target.value }))
                  }
                  required
                >
                  <option value="">Select condition</option>
                  {PRODUCT_CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>
                      {condition}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full-row">
                Description
                <textarea
                  rows={4}
                  value={controller.productForm.description}
                  onChange={(e) =>
                    controller.setProductForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </label>
              <label className="full-row">
                Image URLs (one URL per line or comma separated)
                <textarea
                  rows={3}
                  value={controller.productForm.imageUrlsText}
                  onChange={(e) =>
                    controller.setProductForm((prev) => ({
                      ...prev,
                      imageUrlsText: e.target.value
                    }))
                  }
                  placeholder="https://.../image-1.jpg&#10;https://.../image-2.jpg"
                />
              </label>
              <label className="full-row">
                Delivery methods
                <div className="delivery-methods-editor">
                  {DELIVERY_METHODS.map((method) => (
                    <label key={method.value} className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={controller.productForm.deliveryMethodsAvailable.includes(method.value)}
                        onChange={(event) =>
                          controller.setProductForm((prev) => {
                            const nextSet = new Set(prev.deliveryMethodsAvailable)
                            if (event.target.checked) {
                              nextSet.add(method.value)
                            } else {
                              nextSet.delete(method.value)
                            }
                            return { ...prev, deliveryMethodsAvailable: Array.from(nextSet) }
                          })
                        }
                      />
                      {method.label}
                    </label>
                  ))}
                </div>
              </label>
              {controller.productForm.deliveryMethodsAvailable.includes('BUYER_TO_SELLER') ? (
                <div className="full-row pickup-address-grid">
                  <label>
                    Pickup recipient name
                    <input
                      type="text"
                      value={controller.productForm.pickupAddressRecipientName}
                      onChange={(e) =>
                        controller.setProductForm((prev) => ({
                          ...prev,
                          pickupAddressRecipientName: e.target.value
                        }))
                      }
                    />
                  </label>
                  <label>
                    Pickup phone number
                    <input
                      type="text"
                      value={controller.productForm.pickupAddressPhoneNumber}
                      onChange={(e) =>
                        controller.setProductForm((prev) => ({
                          ...prev,
                          pickupAddressPhoneNumber: e.target.value
                        }))
                      }
                    />
                  </label>
                  <label className="full-row">
                    Pickup address line
                    <input
                      type="text"
                      value={controller.productForm.pickupAddressLine}
                      onChange={(e) =>
                        controller.setProductForm((prev) => ({
                          ...prev,
                          pickupAddressLine: e.target.value
                        }))
                      }
                    />
                  </label>
                </div>
              ) : null}
              <label className="full-row">
                Specifications
                <div className="spec-editor">
                  {controller.productForm.specifications.map((spec, index) => (
                    <div className="spec-row" key={`spec-${index}`}>
                      <input
                        type="text"
                        placeholder="Key (e.g. Brand)"
                        value={spec.key}
                        onChange={(event) =>
                          controller.setProductForm((prev) => ({
                            ...prev,
                            specifications: prev.specifications.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, key: event.target.value } : row
                            )
                          }))
                        }
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. VXE)"
                        value={spec.value}
                        onChange={(event) =>
                          controller.setProductForm((prev) => ({
                            ...prev,
                            specifications: prev.specifications.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, value: event.target.value } : row
                            )
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="secondary-btn spec-remove-btn"
                        onClick={() =>
                          controller.setProductForm((prev) => {
                            if (prev.specifications.length === 1) {
                              return { ...prev, specifications: [{ key: '', value: '' }] }
                            }
                            return {
                              ...prev,
                              specifications: prev.specifications.filter((_, rowIndex) => rowIndex !== index)
                            }
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="secondary-btn spec-add-btn"
                    onClick={() =>
                      controller.setProductForm((prev) => ({
                        ...prev,
                        specifications: [...prev.specifications, { key: '', value: '' }]
                      }))
                    }
                  >
                    + Add specification
                  </button>
                </div>
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={controller.closeProductForm}>
                  Cancel
                </button>
                <button type="submit" className="action-btn" disabled={controller.isSavingProduct}>
                  {controller.isSavingProduct
                    ? 'Saving...'
                    : controller.productFormMode === 'create'
                      ? 'Create'
                      : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedUser ? (
        <div className="modal-backdrop" onClick={() => controller.setSelectedUser(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h4>User Detail</h4>
            <p>
              <strong>User ID:</strong> {selectedUser.id}
            </p>
            <p>
              <strong>Name:</strong> {selectedUser.name || '-'}
            </p>
            <p>
              <strong>Email:</strong> {selectedUser.email || '-'}
            </p>
            <p>
              <strong>Phone number:</strong> {selectedUser.phoneNumber || '-'}
            </p>
            <p>
              <strong>University:</strong> {selectedUser.university || '-'}
            </p>
            <p>
              <strong>Student ID:</strong> {selectedUser.studentId || '-'}
            </p>
            <p>
              <strong>Wallet balance:</strong>{' '}
              {formatWalletBalance(selectedUser.walletBalance, walletCurrency)}
            </p>
            <p>
              <strong>Bought count:</strong>{' '}
              {selectedUser.boughtCount == null ? '-' : selectedUser.boughtCount}
            </p>
            <p>
              <strong>Sold count:</strong>{' '}
              {selectedUser.soldCount == null ? '-' : selectedUser.soldCount}
            </p>
            <p>
              <strong>Rating:</strong>{' '}
              {selectedUser.averageRating == null
                ? '-'
                : `${selectedUser.averageRating.toFixed(1)} (${selectedUser.ratingCount ?? 0})`}
            </p>
            <p>
              <strong>Status:</strong> {selectedUser.isLocked ? 'Locked' : 'Active'}
            </p>
            <div className="modal-actions">
              <button
                className="secondary-btn"
                onClick={() =>
                  void controller.handleToggleUserLock(selectedUser.id, selectedUser.isLocked)
                }
                disabled={controller.processingUserIds.includes(selectedUser.id)}
              >
                {controller.processingUserIds.includes(selectedUser.id)
                  ? 'Processing...'
                  : selectedUser.isLocked
                    ? 'Unlock'
                    : 'Lock'}
              </button>
              <button className="action-btn" onClick={() => controller.setSelectedUser(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {controller.selectedReport ? (
        <div className="modal-backdrop" onClick={() => controller.setSelectedReportId(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h4>Report Detail</h4>
            <p>
              <strong>ID:</strong> {controller.selectedReport.id}
            </p>
            <p>
              <strong>Type:</strong> {controller.selectedReport.type}
            </p>
            <p>
              <strong>Reporter:</strong> {controller.selectedReport.reporter}
            </p>
            <p>
              <strong>Reason:</strong> {controller.selectedReport.reason}
            </p>
            <p>
              <strong>Status:</strong> {controller.selectedReport.status}
            </p>
            <p>
              <strong>Created:</strong> {formatDateTime(controller.selectedReport.createdAt)}
            </p>
            <p>
              <strong>Details:</strong> {controller.selectedReport.details}
            </p>
            <div className="modal-actions">
              {controller.selectedReport.status === 'Pending' ? (
                <button
                  className="secondary-btn"
                  onClick={() => void controller.handleResolveReport(controller.selectedReport!.id)}
                  disabled={controller.processingReportIds.includes(controller.selectedReport.id)}
                >
                  {controller.processingReportIds.includes(controller.selectedReport.id)
                    ? 'Resolving...'
                    : 'Resolve'}
                </button>
              ) : null}
              <button className="action-btn" onClick={() => controller.setSelectedReportId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function ContentSection({
  controller,
  walletCurrency,
  setWalletCurrency
}: {
  controller: AdminController
  walletCurrency: WalletCurrency
  setWalletCurrency: (value: WalletCurrency) => void
}) {
  const [moderationFilter, setModerationFilter] = useState<ModerationFilter>('PENDING')
  const [rejectingProduct, setRejectingProduct] = useState<ProductItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [selectedDetailImageIndex, setSelectedDetailImageIndex] = useState(0)
  const [selectedPayoutForQr, setSelectedPayoutForQr] = useState<PayoutItem | null>(null)
  const [productDateFrom, setProductDateFrom] = useState('')
  const [productDateTo, setProductDateTo] = useState('')
  const [productDateFromDraft, setProductDateFromDraft] = useState('')
  const [productDateToDraft, setProductDateToDraft] = useState('')
  const [productSortOrder, setProductSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [productPriceCurrency, setProductPriceCurrency] = useState<WalletCurrency>('VND')
  const [reportDateFrom, setReportDateFrom] = useState('')
  const [reportDateTo, setReportDateTo] = useState('')
  const [reportDateFromDraft, setReportDateFromDraft] = useState('')
  const [reportDateToDraft, setReportDateToDraft] = useState('')
  const [reportSortOrder, setReportSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [payoutDateFrom, setPayoutDateFrom] = useState('')
  const [payoutDateTo, setPayoutDateTo] = useState('')
  const [payoutDateFromDraft, setPayoutDateFromDraft] = useState('')
  const [payoutDateToDraft, setPayoutDateToDraft] = useState('')
  const [payoutSortOrder, setPayoutSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [orderDateFrom, setOrderDateFrom] = useState('')
  const [orderDateTo, setOrderDateTo] = useState('')
  const [orderDateFromDraft, setOrderDateFromDraft] = useState('')
  const [orderDateToDraft, setOrderDateToDraft] = useState('')
  const [orderSortOrder, setOrderSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>('ALL')
  const [orderCurrency, setOrderCurrency] = useState<WalletCurrency>('VND')

  const isInDateRange = (value: number, fromDate: string, toDate: string): boolean => {
    const hasFrom = fromDate.trim().length > 0
    const hasTo = toDate.trim().length > 0
    if (!hasFrom && !hasTo) return true
    if (!Number.isFinite(value) || value <= 0) return false

    if (hasFrom) {
      const from = new Date(`${fromDate}T00:00:00`).getTime()
      if (Number.isFinite(from) && value < from) return false
    }

    if (hasTo) {
      const to = new Date(`${toDate}T23:59:59.999`).getTime()
      if (Number.isFinite(to) && value > to) return false
    }

    return true
  }

  const filteredProductRows = controller.productResults.filter((item) =>
    isInDateRange(item.createdAt, productDateFrom, productDateTo)
  )
  const filteredReportRows = controller.reportResults.filter((item) =>
    isInDateRange(item.createdAt, reportDateFrom, reportDateTo)
  )
  const filteredPayoutRows = controller.payoutResults.filter((item) =>
    isInDateRange(item.createdAt, payoutDateFrom, payoutDateTo)
  )
  const filteredOrderRows = controller.orderResults.filter((item) =>
    isInDateRange(item.createdAt, orderDateFrom, orderDateTo)
  )

  const sortedProductRows = [...filteredProductRows].sort((a, b) =>
    productSortOrder === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
  )
  const sortedReportRows = [...filteredReportRows].sort((a, b) =>
    reportSortOrder === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
  )
  const sortedPayoutRows = [...filteredPayoutRows].sort((a, b) =>
    payoutSortOrder === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
  )
  const sortedOrderRows = [...filteredOrderRows].sort((a, b) =>
    orderSortOrder === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
  )

  const applyDateRange = (
    fromDraft: string,
    toDraft: string,
    apply: (from: string, to: string) => void
  ) => {
    if (fromDraft && toDraft && fromDraft > toDraft) {
      controller.setActionMessage('"From" date must be earlier than or equal to "To" date.')
      return
    }
    apply(fromDraft, toDraft)
  }

  const moderationRows = sortedProductRows.filter((item) => {
    if (moderationFilter === 'ALL') return true
    return item.moderationStatus === moderationFilter
  })

  const moderationCounts = {
    ALL: filteredProductRows.length,
    PENDING: filteredProductRows.filter((item) => item.moderationStatus === 'PENDING').length,
    APPROVED: filteredProductRows.filter((item) => item.moderationStatus === 'APPROVED').length,
    REJECTED: filteredProductRows.filter((item) => item.moderationStatus === 'REJECTED').length,
    DISABLED: filteredProductRows.filter((item) => item.moderationStatus === 'DISABLED').length
  }

  const orderStatusOptions: OrderStatusFilter[] = [
    'ALL',
    'WAITING_PAYMENT',
    'WAITING_CONFIRMATION',
    'WAITING_PICKUP',
    'SHIPPING',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'UNKNOWN'
  ]
  const orderRows = sortedOrderRows.filter((item) => {
    if (orderStatusFilter === 'ALL') return true
    return item.status.toUpperCase() === orderStatusFilter
  })
  const orderCounts = orderStatusOptions.reduce<Record<OrderStatusFilter, number>>((acc, status) => {
    acc[status] =
      status === 'ALL'
        ? filteredOrderRows.length
        : filteredOrderRows.filter((item) => item.status.toUpperCase() === status).length
    return acc
  }, {} as Record<OrderStatusFilter, number>)

  const handleOpenReject = (item: ProductItem) => {
    setRejectingProduct(item)
    setRejectReason('')
  }

  const handleSubmitReject = async () => {
    if (!rejectingProduct) return
    const trimmedReason = rejectReason.trim()
    if (!trimmedReason) {
      controller.setActionMessage('Rejection reason is required.')
      return
    }
    await controller.handleModerateProduct(rejectingProduct, 'REJECT', trimmedReason)
    setRejectingProduct(null)
    setRejectReason('')
  }

  useEffect(() => {
    setSelectedDetailImageIndex(0)
  }, [controller.selectedProduct?.id])

  const qrModal = selectedPayoutForQr ? (
    <div className="modal-backdrop" onClick={() => setSelectedPayoutForQr(null)}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h4>Payout Transfer QR</h4>
        <p>
          <strong>Seller:</strong> {selectedPayoutForQr.seller}
        </p>
        <p>
          <strong>Amount:</strong> {selectedPayoutForQr.amount}
        </p>
        <p>
          <strong>Bank:</strong> {selectedPayoutForQr.receiverBankName || '-'}
        </p>
        <p>
          <strong>Account name:</strong> {selectedPayoutForQr.receiverAccountName || '-'}
        </p>
        <p>
          <strong>Account number:</strong> {selectedPayoutForQr.receiverAccountNumber || '-'}
        </p>
        <p>
          <strong>Transfer content:</strong> {`RUT ${selectedPayoutForQr.id.slice(-8).toUpperCase()}`}
        </p>
        {buildPayoutQrUrl(selectedPayoutForQr) ? (
          <img
            className="payout-qr-image"
            src={buildPayoutQrUrl(selectedPayoutForQr) || ''}
            alt={`QR for payout ${selectedPayoutForQr.id}`}
          />
        ) : (
          <p className="error-text">Cannot generate QR for this receiving method.</p>
        )}
        <div className="modal-actions">
          <button className="action-btn" onClick={() => setSelectedPayoutForQr(null)}>
            Close
          </button>
        </div>
      </div>
    </div>
  ) : null

  const refreshButton = (
    <button
      type="button"
      className="secondary-btn"
      onClick={() => void controller.handleRefreshToolData()}
      disabled={controller.isDashboardLoading}
    >
      {controller.isDashboardLoading ? 'Refreshing...' : 'Refresh'}
    </button>
  )

  const productTimeFilter = (
    <div className="time-filter-bar">
      <label className="time-filter-field">
        From
        <input
          type="date"
          className="time-filter-input"
          value={productDateFromDraft}
          onChange={(event) => setProductDateFromDraft(event.target.value)}
        />
      </label>
      <label className="time-filter-field">
        To
        <input
          type="date"
          className="time-filter-input"
          value={productDateToDraft}
          onChange={(event) => setProductDateToDraft(event.target.value)}
        />
      </label>
      <label className="time-filter-field">
        Sort
        <select
          className="time-filter-input"
          value={productSortOrder}
          onChange={(event) => setProductSortOrder(event.target.value as 'newest' | 'oldest')}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </label>
      <button
        type="button"
        className="action-btn"
        onClick={() =>
          applyDateRange(productDateFromDraft, productDateToDraft, (from, to) => {
            setProductDateFrom(from)
            setProductDateTo(to)
          })
        }
        disabled={productDateFromDraft === productDateFrom && productDateToDraft === productDateTo}
      >
        Apply
      </button>
      <button
        type="button"
        className="secondary-btn"
        onClick={() => {
          setProductDateFrom('')
          setProductDateTo('')
          setProductDateFromDraft('')
          setProductDateToDraft('')
        }}
      >
        Clear time
      </button>
    </div>
  )

  const reportTimeFilter = (
    <div className="time-filter-bar">
      <label className="time-filter-field">
        From
        <input
          type="date"
          className="time-filter-input"
          value={reportDateFromDraft}
          onChange={(event) => setReportDateFromDraft(event.target.value)}
        />
      </label>
      <label className="time-filter-field">
        To
        <input
          type="date"
          className="time-filter-input"
          value={reportDateToDraft}
          onChange={(event) => setReportDateToDraft(event.target.value)}
        />
      </label>
      <label className="time-filter-field">
        Sort
        <select
          className="time-filter-input"
          value={reportSortOrder}
          onChange={(event) => setReportSortOrder(event.target.value as 'newest' | 'oldest')}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </label>
      <button
        type="button"
        className="action-btn"
        onClick={() =>
          applyDateRange(reportDateFromDraft, reportDateToDraft, (from, to) => {
            setReportDateFrom(from)
            setReportDateTo(to)
          })
        }
        disabled={reportDateFromDraft === reportDateFrom && reportDateToDraft === reportDateTo}
      >
        Apply
      </button>
      <button
        type="button"
        className="secondary-btn"
        onClick={() => {
          setReportDateFrom('')
          setReportDateTo('')
          setReportDateFromDraft('')
          setReportDateToDraft('')
        }}
      >
        Clear time
      </button>
    </div>
  )

  const payoutTimeFilter = (
    <div className="time-filter-bar">
      <label className="time-filter-field">
        From
        <input
          type="date"
          className="time-filter-input"
          value={payoutDateFromDraft}
          onChange={(event) => setPayoutDateFromDraft(event.target.value)}
        />
      </label>
      <label className="time-filter-field">
        To
        <input
          type="date"
          className="time-filter-input"
          value={payoutDateToDraft}
          onChange={(event) => setPayoutDateToDraft(event.target.value)}
        />
      </label>
      <label className="time-filter-field">
        Sort
        <select
          className="time-filter-input"
          value={payoutSortOrder}
          onChange={(event) => setPayoutSortOrder(event.target.value as 'newest' | 'oldest')}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </label>
      <button
        type="button"
        className="action-btn"
        onClick={() =>
          applyDateRange(payoutDateFromDraft, payoutDateToDraft, (from, to) => {
            setPayoutDateFrom(from)
            setPayoutDateTo(to)
          })
        }
        disabled={payoutDateFromDraft === payoutDateFrom && payoutDateToDraft === payoutDateTo}
      >
        Apply
      </button>
      <button
        type="button"
        className="secondary-btn"
        onClick={() => {
          setPayoutDateFrom('')
          setPayoutDateTo('')
          setPayoutDateFromDraft('')
          setPayoutDateToDraft('')
        }}
      >
        Clear time
      </button>
    </div>
  )

  const orderTimeFilter = (
    <div className="time-filter-bar">
      <label className="time-filter-field">
        From
        <input
          type="date"
          className="time-filter-input"
          value={orderDateFromDraft}
          onChange={(event) => setOrderDateFromDraft(event.target.value)}
        />
      </label>
      <label className="time-filter-field">
        To
        <input
          type="date"
          className="time-filter-input"
          value={orderDateToDraft}
          onChange={(event) => setOrderDateToDraft(event.target.value)}
        />
      </label>
      <label className="time-filter-field">
        Sort
        <select
          className="time-filter-input"
          value={orderSortOrder}
          onChange={(event) => setOrderSortOrder(event.target.value as 'newest' | 'oldest')}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </label>
      <button
        type="button"
        className="action-btn"
        onClick={() =>
          applyDateRange(orderDateFromDraft, orderDateToDraft, (from, to) => {
            setOrderDateFrom(from)
            setOrderDateTo(to)
          })
        }
        disabled={orderDateFromDraft === orderDateFrom && orderDateToDraft === orderDateTo}
      >
        Apply
      </button>
      <button
        type="button"
        className="secondary-btn"
        onClick={() => {
          setOrderDateFrom('')
          setOrderDateTo('')
          setOrderDateFromDraft('')
          setOrderDateToDraft('')
        }}
      >
        Clear time
      </button>
    </div>
  )

  switch (controller.activeScreen) {
    case 'dashboard':
      return (
        <>
          <div className="panel-top tool-header">
            <h3>Dashboard</h3>
            {refreshButton}
          </div>
          <section className="stats-grid">
            <article className="stat-card">
              <p>Total Users</p>
              <strong>{controller.stats.totalUsers.toLocaleString()}</strong>
            </article>
            <article className="stat-card">
              <p>Pending Verifications</p>
              <strong>{controller.stats.pendingVerifications.toLocaleString()}</strong>
            </article>
            <article className="stat-card">
              <p>Active Reports</p>
              <strong>{controller.stats.activeReports.toLocaleString()}</strong>
            </article>
            <article className="stat-card">
              <p>Today's Sales</p>
              <strong>{toMoney(controller.stats.todaySales)}</strong>
            </article>
          </section>

          <section className="grid-two">
            <article className="panel">
              <h3>Recent Reports</h3>
              {controller.isDashboardLoading ? <p className="panel-note">Loading reports...</p> : null}
              {controller.dashboardError ? <p className="error-text">{controller.dashboardError}</p> : null}
              {!controller.isDashboardLoading &&
              !controller.dashboardError &&
              controller.reports.length === 0 ? (
                <p className="panel-note">No data yet.</p>
              ) : null}
              <ReportsTable controller={controller} rows={controller.reportResults.slice(0, 10)} />
            </article>

            <article className="panel payouts-panel">
              <h3>Pending Payouts</h3>
              <ul className="payout-list">
                {controller.payoutResults.filter((item) => item.status === 'PENDING').slice(0, 8).map((item) => (
                  <li key={item.id}>
                    <div>
                      <p>{item.seller}</p>
                      <strong>{item.amount}</strong>
                      <p className="panel-note">Bank: {item.receiverBankName || '-'}</p>
                      <p className="panel-note">Account name: {item.receiverAccountName || '-'}</p>
                      <p className="panel-note">Account number: {item.receiverAccountNumber || '-'}</p>
                    </div>
                    <div className="payout-actions">
                      <button className="secondary-btn" onClick={() => setSelectedPayoutForQr(item)}>
                        Generate QR
                      </button>
                      <button
                        className="approve-btn"
                        onClick={() => void controller.handleApprovePayout(item.id)}
                        disabled={controller.processingPayoutIds.includes(item.id)}
                      >
                        {controller.processingPayoutIds.includes(item.id) ? 'Approving...' : 'Approve'}
                      </button>
                    </div>
                  </li>
                ))}
                {controller.payoutResults.filter((item) => item.status === 'PENDING').length === 0 ? (
                  <li className="empty-payout">No pending payouts.</li>
                ) : null}
              </ul>
            </article>
          </section>
          {qrModal}
        </>
      )

    case 'users':
      return (
        <article className="panel">
          <div className="panel-top">
            <h3>User Management</h3>
            <div className="panel-actions">
              <label className="wallet-currency-wrap">
                Currency
                <select
                  className="wallet-currency-select"
                  value={walletCurrency}
                  onChange={(e) => setWalletCurrency(e.target.value as WalletCurrency)}
                >
                  <option value="USD">$ (USD, 1$ = {USD_TO_VND_RATE.toLocaleString('vi-VN')}đ)</option>
                  <option value="VND">VND (₫)</option>
                </select>
              </label>
              {refreshButton}
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone Number</th>
                  <th>Wallet Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {controller.userResults.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>
                      <div className="user-name-cell">
                        {item.avatarUrl ? (
                          <img className="user-avatar" src={item.avatarUrl} alt={`${item.name} avatar`} />
                        ) : (
                          <span className="user-avatar user-avatar-fallback">
                            {getDisplayInitial(item.name)}
                          </span>
                        )}
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td>{item.email}</td>
                    <td>{item.phoneNumber || '-'}</td>
                    <td>{formatWalletBalance(item.walletBalance, walletCurrency)}</td>
                    <td>
                      <span className={`status-chip ${item.isLocked ? 'locked' : 'active'}`}>
                        {item.isLocked ? 'Locked' : 'Active'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="secondary-btn" onClick={() => controller.setSelectedUser(item)}>
                        Details
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={() => void controller.handleToggleUserLock(item.id, item.isLocked)}
                        disabled={controller.processingUserIds.includes(item.id)}
                      >
                        {controller.processingUserIds.includes(item.id)
                          ? 'Processing...'
                          : item.isLocked
                            ? 'Unlock'
                            : 'Lock'}
                      </button>
                      <button
                        className="danger-btn"
                        onClick={() => void controller.handleDeleteUser(item.id, item.name)}
                        disabled={controller.processingUserIds.includes(item.id)}
                      >
                        {controller.processingUserIds.includes(item.id) ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
                {controller.userResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      )

    case 'orders':
      if (controller.selectedOrder) {
        const detail = controller.selectedOrder
        return (
          <article className="panel product-detail-page">
            <div className="panel-top">
              <div>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => controller.setSelectedOrder(null)}
                >
                  Back to list
                </button>
                <h3 className="product-detail-title">Order {detail.id}</h3>
                <p className="panel-note">{detail.productName}</p>
              </div>
              <div className="actions-cell">
                {refreshButton}
              </div>
            </div>

            <section className="product-detail-grid">
              <div className="product-detail-media">
                {detail.productImageUrl ? (
                  <img src={detail.productImageUrl} alt={detail.productName} className="product-detail-image" />
                ) : (
                  <div className="product-detail-image placeholder">No image</div>
                )}
              </div>
              <div className="product-detail-meta">
                <p>
                  <strong>Status:</strong>{' '}
                  <span className={`status-chip ${detail.status.toLowerCase()}`}>
                    {detail.statusLabel || detail.status}
                  </span>
                </p>
                <p>
                  <strong>Total:</strong> {formatPriceFromVnd(detail.totalAmount, orderCurrency)}
                </p>
                <p>
                  <strong>Quantity:</strong> {detail.quantity}
                </p>
                <p>
                  <strong>Unit price:</strong> {formatPriceFromVnd(detail.unitPrice, orderCurrency)}
                </p>
                <p>
                  <strong>Buyer:</strong> {detail.buyerName || '-'} ({detail.buyerId || '-'})
                </p>
                <p>
                  <strong>Buyer phone:</strong> {detail.buyerPhoneNumber || '-'}
                </p>
                <p>
                  <strong>Seller:</strong> {detail.sellerName || '-'} ({detail.sellerId || '-'})
                </p>
                <p>
                  <strong>Seller phone:</strong> {detail.sellerPhoneNumber || '-'}
                </p>
                <p>
                  <strong>Product ID:</strong> {detail.productId || '-'}
                </p>
                <p>
                  <strong>Delivery method:</strong> {detail.deliveryMethod || '-'}
                </p>
                <p>
                  <strong>Payment:</strong> {formatOrderPaymentDetails(detail)}
                </p>
                <p>
                  <strong>Transfer content:</strong> {detail.transferContent || '-'}
                </p>
                <p>
                  <strong>Meeting point:</strong> {detail.meetingPoint || '-'}
                </p>
                <p>
                  <strong>Created:</strong> {formatDateTime(detail.createdAt)}
                </p>
                <p>
                  <strong>Updated:</strong> {formatDateTime(detail.updatedAt)}
                </p>
                <p>
                  <strong>Payment expires:</strong> {formatDateTime(detail.paymentExpiresAt)}
                </p>
                <p>
                  <strong>Payment confirmed:</strong> {formatDateTime(detail.paymentConfirmedAt)}
                </p>
                <div className="product-detail-section">
                  <p>
                    <strong>Buyer address:</strong>
                  </p>
                  <p className="panel-note">{formatOrderAddress(detail.buyerAddress)}</p>
                </div>
                <div className="product-detail-section">
                  <p>
                    <strong>Seller address:</strong>
                  </p>
                  <p className="panel-note">{formatOrderAddress(detail.sellerAddress)}</p>
                </div>
                <div className="product-detail-section">
                  <p>
                    <strong>Product detail:</strong>
                  </p>
                  <p className="panel-note">{detail.productDetail || 'No details.'}</p>
                </div>
              </div>
            </section>
          </article>
        )
      }

      return (
        <article className="panel">
          <div className="panel-top">
            <h3>Order Management</h3>
            <div className="panel-actions">
              <label className="wallet-currency-wrap">
                Currency
                <select
                  className="wallet-currency-select"
                  value={orderCurrency}
                  onChange={(e) => setOrderCurrency(e.target.value as WalletCurrency)}
                >
                  <option value="VND">VND (â‚«)</option>
                  <option value="USD">$ (USD, 1$ = {USD_TO_VND_RATE.toLocaleString('vi-VN')}Ä‘)</option>
                </select>
              </label>
              {refreshButton}
            </div>
          </div>
          {orderTimeFilter}
          <div className="moderation-filters">
            {orderStatusOptions.map((status) => (
              <button
                key={status}
                type="button"
                className={`moderation-filter-btn ${orderStatusFilter === status ? 'active' : ''}`}
                onClick={() => setOrderStatusFilter(status)}
              >
                {status} ({orderCounts[status]})
              </button>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Product</th>
                  <th>Buyer</th>
                  <th>Seller</th>
                  <th>Total ({orderCurrency})</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orderRows.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.productName}</td>
                    <td>{item.buyerName || item.buyerId || '-'}</td>
                    <td>{item.sellerName || item.sellerId || '-'}</td>
                    <td>{formatPriceFromVnd(item.totalAmount, orderCurrency)}</td>
                    <td>
                      <span className={`status-chip ${item.status.toLowerCase()}`}>
                        {item.statusLabel || item.status}
                      </span>
                    </td>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td className="actions-cell">
                      <button className="action-btn" onClick={() => controller.setSelectedOrder(item)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {orderRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-cell">
                      No orders found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      )

    case 'products':
      if (controller.selectedProduct) {
        const detail = controller.selectedProduct
        const detailImages = detail.imageUrls.length > 0 ? detail.imageUrls : ['']
        const selectedImage =
          detailImages[selectedDetailImageIndex] ?? detailImages[0]
        const specEntries = Object.entries(detail.specifications ?? {})
        return (
          <article className="panel product-detail-page">
            <div className="panel-top">
              <div>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => controller.setSelectedProduct(null)}
                >
                  Back to list
                </button>
                <h3 className="product-detail-title">{detail.name}</h3>
                <p className="panel-note">Product ID: {detail.id}</p>
              </div>
              <div className="actions-cell">
                {refreshButton}
                {detail.moderationStatus === 'PENDING' ? (
                  <>
                    <button
                      className="approve-btn"
                      onClick={() => void controller.handleModerateProduct(detail, 'APPROVE')}
                      disabled={controller.processingProductIds.includes(detail.id)}
                    >
                      {controller.processingProductIds.includes(detail.id) ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      className="danger-btn"
                      onClick={() => handleOpenReject(detail)}
                      disabled={controller.processingProductIds.includes(detail.id)}
                    >
                      {controller.processingProductIds.includes(detail.id) ? 'Processing...' : 'Reject'}
                    </button>
                  </>
                ) : null}
                {detail.moderationStatus === 'APPROVED' ? (
                  <button
                    className="danger-btn"
                    onClick={() => void controller.handleModerateProduct(detail, 'DISABLE', 'Disabled by admin')}
                    disabled={controller.processingProductIds.includes(detail.id)}
                  >
                    {controller.processingProductIds.includes(detail.id) ? 'Processing...' : 'Disable'}
                  </button>
                ) : null}
                {detail.moderationStatus === 'DISABLED' ? (
                  <button
                    className="approve-btn"
                    onClick={() => void controller.handleModerateProduct(detail, 'ENABLE')}
                    disabled={controller.processingProductIds.includes(detail.id)}
                  >
                    {controller.processingProductIds.includes(detail.id) ? 'Processing...' : 'Enable'}
                  </button>
                ) : null}
                <button className="secondary-btn" onClick={() => controller.openEditProductForm(detail)}>
                  Edit
                </button>
                <button
                  className="danger-btn"
                  onClick={() => void controller.handleDeleteProduct(detail)}
                  disabled={controller.processingProductIds.includes(detail.id)}
                >
                  {controller.processingProductIds.includes(detail.id) ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>

            <section className="product-detail-grid">
              <div className="product-detail-media">
                {selectedImage ? (
                  <img src={selectedImage} alt={detail.name} className="product-detail-image" />
                ) : (
                  <div className="product-detail-image placeholder">No image</div>
                )}
                {detail.imageUrls.length > 0 ? (
                  <div className="product-preview-list">
                    {detail.imageUrls.map((url, index) => (
                      <button
                        key={`${detail.id}-${index}`}
                        type="button"
                        className={`product-preview-item ${selectedDetailImageIndex === index ? 'active' : ''}`}
                        onClick={() => setSelectedDetailImageIndex(index)}
                      >
                        <img src={url} alt={`${detail.name} preview ${index + 1}`} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="product-detail-meta">
                <p>
                  <strong>Status:</strong>{' '}
                  <span className={`status-chip ${detail.moderationStatus.toLowerCase()}`}>
                    {detail.moderationStatus}
                  </span>
                </p>
                <p>
                  <strong>Seller ID:</strong> {detail.sellerId || '-'}
                </p>
                <p>
                  <strong>Seller:</strong> {detail.sellerName}
                </p>
                <p>
                  <strong>Price:</strong> {formatPriceFromVnd(detail.price, productPriceCurrency)}
                </p>
                <p>
                  <strong>Quantity:</strong>{' '}
                  {detail.quantityAvailable == null ? '-' : detail.quantityAvailable}
                </p>
                <p>
                  <strong>Category:</strong> {detail.category || '-'}
                </p>
                <p>
                  <strong>Condition:</strong> {detail.condition || '-'}
                </p>
                <p>
                  <strong>Delivery methods:</strong>{' '}
                  {detail.deliveryMethodsAvailable.length > 0
                    ? detail.deliveryMethodsAvailable.join(', ')
                    : '-'}
                </p>
                <p>
                  <strong>Pickup address:</strong>{' '}
                  {detail.sellerPickupAddress
                    ? `${detail.sellerPickupAddress.recipientName} | ${detail.sellerPickupAddress.phoneNumber} | ${detail.sellerPickupAddress.addressLine}`
                    : '-'}
                </p>
                <p>
                  <strong>Posted:</strong> {formatDateTime(detail.createdAt)}
                </p>
                <div className="product-detail-section">
                  <p>
                    <strong>Description:</strong>
                  </p>
                  <p className="panel-note">{detail.description || 'No description.'}</p>
                </div>
                <div className="product-detail-section">
                  <p>
                    <strong>Specifications:</strong>
                  </p>
                  {specEntries.length > 0 ? (
                    <ul className="product-spec-list">
                      {specEntries.map(([key, value]) => (
                        <li key={key}>
                          <strong>{key}:</strong> {value}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="panel-note">No specifications.</p>
                  )}
                </div>
              </div>
            </section>
          </article>
        )
      }

      return (
        <article className="panel">
          <div className="panel-top">
            <h3>Product Moderation</h3>
            <div className="panel-actions">
              {refreshButton}
              <button className="action-btn" onClick={controller.openCreateProductForm}>
                Add Product
              </button>
            </div>
          </div>
          <section className="moderation-tools">
            {productTimeFilter}
            <div className="moderation-toolbar-row">
              <label className="wallet-currency-wrap">
                Price currency
                <select
                  className="wallet-currency-select"
                  value={productPriceCurrency}
                  onChange={(e) => setProductPriceCurrency(e.target.value as WalletCurrency)}
                >
                  <option value="VND">VND (₫)</option>
                  <option value="USD">$ (USD, 1$ = {USD_TO_VND_RATE.toLocaleString('vi-VN')}đ)</option>
                </select>
              </label>
            </div>
            <p className="panel-note">Review pending products, approve to publish, reject with violation reason.</p>
            <div className="moderation-filters">
              {(['PENDING', 'APPROVED', 'REJECTED', 'DISABLED', 'ALL'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  className={`moderation-filter-btn ${moderationFilter === filterKey ? 'active' : ''}`}
                  onClick={() => setModerationFilter(filterKey)}
                >
                  {filterKey} ({moderationCounts[filterKey]})
                </button>
              ))}
            </div>
          </section>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product ID</th>
                  <th>Name</th>
                  <th>Price ({productPriceCurrency})</th>
                  <th>Seller ID</th>
                  <th>Seller</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {moderationRows.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td>{formatPriceFromVnd(item.price, productPriceCurrency)}</td>
                    <td>{item.sellerId || '-'}</td>
                    <td>{item.sellerName}</td>
                    <td>
                      <span className={`status-chip ${item.moderationStatus.toLowerCase()}`}>
                        {item.moderationStatus}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="action-btn" onClick={() => controller.setSelectedProduct(item)}>
                        View
                      </button>
                      <button className="secondary-btn" onClick={() => controller.openEditProductForm(item)}>
                        Edit
                      </button>
                      {item.moderationStatus === 'PENDING' ? (
                        <>
                          <button
                            className="approve-btn"
                            onClick={() => void controller.handleModerateProduct(item, 'APPROVE')}
                            disabled={controller.processingProductIds.includes(item.id)}
                          >
                            {controller.processingProductIds.includes(item.id) ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            className="danger-btn"
                            onClick={() => handleOpenReject(item)}
                            disabled={controller.processingProductIds.includes(item.id)}
                          >
                            {controller.processingProductIds.includes(item.id) ? 'Processing...' : 'Reject'}
                          </button>
                        </>
                      ) : null}
                      {item.moderationStatus === 'APPROVED' ? (
                        <button
                          className="danger-btn"
                          onClick={() =>
                            void controller.handleModerateProduct(item, 'DISABLE', 'Disabled by admin')
                          }
                          disabled={controller.processingProductIds.includes(item.id)}
                        >
                          {controller.processingProductIds.includes(item.id) ? 'Processing...' : 'Disable'}
                        </button>
                      ) : null}
                      {item.moderationStatus === 'DISABLED' ? (
                        <button
                          className="approve-btn"
                          onClick={() => void controller.handleModerateProduct(item, 'ENABLE')}
                          disabled={controller.processingProductIds.includes(item.id)}
                        >
                          {controller.processingProductIds.includes(item.id) ? 'Processing...' : 'Enable'}
                        </button>
                      ) : null}
                      <button
                        className="danger-btn"
                        onClick={() => void controller.handleDeleteProduct(item)}
                        disabled={controller.processingProductIds.includes(item.id)}
                      >
                        {controller.processingProductIds.includes(item.id) ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
                {moderationRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      {moderationFilter === 'ALL'
                        ? 'No products found.'
                        : `No ${moderationFilter.toLowerCase()} products.`}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {rejectingProduct ? (
            <div className="modal-backdrop" onClick={() => setRejectingProduct(null)}>
              <div className="modal-card" onClick={(event) => event.stopPropagation()}>
                <h4>Reject Product</h4>
                <p>
                  <strong>Product:</strong> {rejectingProduct.name}
                </p>
                <p>
                  <strong>ID:</strong> {rejectingProduct.id}
                </p>
                <label className="reject-reason-label">
                  Violation reason
                  <textarea
                    rows={4}
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    placeholder="Explain why this product violates policy..."
                  />
                </label>
                <div className="modal-actions">
                  <button type="button" className="secondary-btn" onClick={() => setRejectingProduct(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => void handleSubmitReject()}
                    disabled={controller.processingProductIds.includes(rejectingProduct.id)}
                  >
                    Confirm Reject
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </article>
      )

    case 'reports':
      return (
        <article className="panel">
          <div className="panel-top">
            <h3>Reported Content</h3>
            {refreshButton}
          </div>
          {reportTimeFilter}
          <ReportsTable controller={controller} rows={sortedReportRows} />
        </article>
      )

    case 'payouts':
      return (
        <>
          <article className="panel">
            <div className="panel-top">
              <h3>Payout Requests</h3>
              {refreshButton}
            </div>
            {payoutTimeFilter}
            <ul className="payout-list">
              {sortedPayoutRows.map((item) => (
                <li key={item.id}>
                  <div>
                    <p>{item.seller}</p>
                    <strong>{item.amount}</strong>
                    <p className="panel-note">Bank: {item.receiverBankName || '-'}</p>
                    <p className="panel-note">Account name: {item.receiverAccountName || '-'}</p>
                    <p className="panel-note">Account number: {item.receiverAccountNumber || '-'}</p>
                    <p>
                      <span className={`status-chip ${item.status.toLowerCase()}`}>{item.status}</span>
                    </p>
                  </div>
                  <div className="payout-actions">
                    <button className="secondary-btn" onClick={() => setSelectedPayoutForQr(item)}>
                      Generate QR
                    </button>
                    {item.status === 'PENDING' ? (
                      <button
                        className="approve-btn"
                        onClick={() => void controller.handleApprovePayout(item.id)}
                        disabled={controller.processingPayoutIds.includes(item.id)}
                      >
                        {controller.processingPayoutIds.includes(item.id) ? 'Approving...' : 'Approve'}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
              {sortedPayoutRows.length === 0 ? (
                <li className="empty-payout">No payout requests.</li>
              ) : null}
            </ul>
          </article>
          {qrModal}
        </>
      )

    case 'settings':
      return (
        <article className="panel">
          <div className="panel-top">
            <h3>Settings</h3>
            {refreshButton}
          </div>
          <p className="panel-note">Dashboard settings will be configured here.</p>
        </article>
      )

    default:
      return null
  }
}

function ReportsTable({
  controller,
  rows
}: {
  controller: AdminController
  rows: AdminController['reportResults']
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Reporter</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>{item.type}</td>
              <td>{item.reporter}</td>
              <td>{item.reason}</td>
              <td>
                <span className={`status-chip ${item.status.toLowerCase()}`}>{item.status}</span>
              </td>
              <td className="actions-cell">
                <button className="action-btn" onClick={() => controller.setSelectedReportId(item.id)}>
                  View
                </button>
                {item.status === 'Pending' ? (
                  <button
                    className="secondary-btn"
                    onClick={() => void controller.handleResolveReport(item.id)}
                    disabled={controller.processingReportIds.includes(item.id)}
                  >
                    {controller.processingReportIds.includes(item.id) ? 'Resolving...' : 'Resolve'}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {rows.length === 0 && !controller.isDashboardLoading ? (
            <tr>
              <td colSpan={5} className="empty-cell">
                No reports found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
