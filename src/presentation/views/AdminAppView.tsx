import { useEffect, useState } from 'react'
import { AdminController } from '../controllers/useAdminController'
import { PayoutItem, ProductItem, ScreenKey } from '../../domain/entities/admin'
import { formatDateTime, toMoney } from '../utils/format'

type Props = {
  controller: AdminController
  themeMode: 'light' | 'dark'
  onToggleTheme: () => void
}

const menuItems: Array<{ key: ScreenKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'User Management' },
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
const DEFAULT_USD_TO_VND_RATE = 26000
const USD_TO_VND_RATE =
  Number.isFinite(Number(import.meta.env.VITE_USD_TO_VND_RATE)) &&
  Number(import.meta.env.VITE_USD_TO_VND_RATE) > 0
    ? Number(import.meta.env.VITE_USD_TO_VND_RATE)
    : DEFAULT_USD_TO_VND_RATE

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

export function AdminAppView({ controller, themeMode, onToggleTheme }: Props) {
  const [walletCurrency, setWalletCurrency] = useState<WalletCurrency>('VND')

  if (controller.authScreenState !== 'authenticated') {
    return (
      <main className="page login-page">
        <div className="bg-lines" />
        <section className="login-card">
          <header className="login-header">
            <div className="brand-row">
              <div className="brand-icon">U</div>
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

  return (
    <main className="page dashboard-page">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">U</div>
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
                  ? 'Search by name, user ID, email'
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
                <input
                  type="text"
                  value={controller.productForm.category}
                  onChange={(e) =>
                    controller.setProductForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                />
              </label>
              <label>
                Image URL
                <input
                  type="url"
                  value={controller.productForm.imageUrl}
                  onChange={(e) =>
                    controller.setProductForm((prev) => ({ ...prev, imageUrl: e.target.value }))
                  }
                />
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

  const moderationRows = controller.productResults.filter((item) => {
    if (moderationFilter === 'ALL') return true
    return item.moderationStatus === moderationFilter
  })

  const moderationCounts = {
    ALL: controller.productResults.length,
    PENDING: controller.productResults.filter((item) => item.moderationStatus === 'PENDING').length,
    APPROVED: controller.productResults.filter((item) => item.moderationStatus === 'APPROVED').length,
    REJECTED: controller.productResults.filter((item) => item.moderationStatus === 'REJECTED').length,
    DISABLED: controller.productResults.filter((item) => item.moderationStatus === 'DISABLED').length
  }

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

  switch (controller.activeScreen) {
    case 'dashboard':
      return (
        <>
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
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Avatar URL</th>
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
                    <td>
                      {item.avatarUrl ? (
                        <a
                          className="avatar-url-link"
                          href={item.avatarUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.avatarUrl}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{formatWalletBalance(item.walletBalance, walletCurrency)}</td>
                    <td>
                      <span className={`status-chip ${item.isLocked ? 'locked' : 'active'}`}>
                        {item.isLocked ? 'Locked' : 'Active'}
                      </span>
                    </td>
                    <td className="actions-cell">
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
                  <strong>Price:</strong> {detail.price == null ? '-' : detail.price}
                </p>
                <p>
                  <strong>Quantity:</strong>{' '}
                  {detail.quantityAvailable == null ? '-' : detail.quantityAvailable}
                </p>
                <p>
                  <strong>Category:</strong> {detail.category || '-'}
                </p>
                <p>
                  <strong>Created:</strong> {formatDateTime(detail.createdAt)}
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
            <button className="action-btn" onClick={controller.openCreateProductForm}>
              Add Product
            </button>
          </div>
          <section className="moderation-tools">
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
                    <td colSpan={6} className="empty-cell">
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
          <h3>Reported Content</h3>
          <ReportsTable controller={controller} rows={controller.reportResults} />
        </article>
      )

    case 'payouts':
      return (
        <>
          <article className="panel">
            <h3>Payout Requests</h3>
            <ul className="payout-list">
              {controller.payoutResults.map((item) => (
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
              {controller.payoutResults.length === 0 ? (
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
          <h3>Settings</h3>
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
