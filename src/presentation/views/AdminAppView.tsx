import { AdminController } from '../controllers/useAdminController'
import { ScreenKey } from '../../domain/entities/admin'
import { formatDateTime, toMoney } from '../utils/format'

type Props = {
  controller: AdminController
}

const menuItems: Array<{ key: ScreenKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'users', label: 'User Management' },
  { key: 'products', label: 'Product Moderation' },
  { key: 'reports', label: 'Reported Content' },
  { key: 'payouts', label: 'Payout Requests' },
  { key: 'settings', label: 'Settings' }
]

export function AdminAppView({ controller }: Props) {
  if (controller.authScreenState !== 'authenticated') {
    return (
      <main className="page login-page">
        <div className="bg-lines" />
        <section className="login-card">
          <header className="brand-row">
            <div className="brand-icon">U</div>
            <h1>UniMarket Admin</h1>
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

        <ContentSection controller={controller} />
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

      {controller.selectedProduct ? (
        <div className="modal-backdrop" onClick={() => controller.setSelectedProduct(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h4>Product Detail</h4>
            <p>
              <strong>ID:</strong> {controller.selectedProduct.id}
            </p>
            <p>
              <strong>Name:</strong> {controller.selectedProduct.name}
            </p>
            <p>
              <strong>Seller ID:</strong> {controller.selectedProduct.sellerId || '-'}
            </p>
            <p>
              <strong>Seller:</strong> {controller.selectedProduct.sellerName}
            </p>
            <p>
              <strong>Status:</strong> {controller.selectedProduct.moderationStatus}
            </p>
            <p>
              <strong>Price:</strong>{' '}
              {controller.selectedProduct.price == null ? '-' : controller.selectedProduct.price}
            </p>
            <p>
              <strong>Quantity:</strong>{' '}
              {controller.selectedProduct.quantityAvailable == null
                ? '-'
                : controller.selectedProduct.quantityAvailable}
            </p>
            <p>
              <strong>Category:</strong> {controller.selectedProduct.category || '-'}
            </p>
            <p>
              <strong>Created:</strong> {formatDateTime(controller.selectedProduct.createdAt)}
            </p>
            <p>
              <strong>Description:</strong> {controller.selectedProduct.description || '-'}
            </p>
            {controller.selectedProduct.imageUrls[0] ? (
              <p>
                <strong>Image:</strong>{' '}
                <a href={controller.selectedProduct.imageUrls[0]} target="_blank" rel="noreferrer">
                  Open
                </a>
              </p>
            ) : null}
            <div className="modal-actions">
              <button
                className="secondary-btn"
                onClick={() => {
                  controller.openEditProductForm(controller.selectedProduct!)
                  controller.setSelectedProduct(null)
                }}
              >
                Edit
              </button>
              <button className="action-btn" onClick={() => controller.setSelectedProduct(null)}>
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
                >
                  Resolve
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

function ContentSection({ controller }: Props) {
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
                {controller.payoutResults.slice(0, 8).map((item) => (
                  <li key={item.id}>
                    <div>
                      <p>{item.seller}</p>
                      <strong>{item.amount}</strong>
                    </div>
                    <button className="approve-btn" onClick={() => void controller.handleApprovePayout(item.id)}>
                      Approve
                    </button>
                  </li>
                ))}
                {controller.payoutResults.length === 0 ? (
                  <li className="empty-payout">No pending payouts.</li>
                ) : null}
              </ul>
            </article>
          </section>
        </>
      )

    case 'users':
      return (
        <article className="panel">
          <h3>User Management</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {controller.userResults.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
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
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {controller.userResults.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">
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
      return (
        <article className="panel">
          <div className="panel-top">
            <h3>Product Moderation</h3>
            <button className="action-btn" onClick={controller.openCreateProductForm}>
              Add Product
            </button>
          </div>
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
                {controller.productResults.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td>{item.sellerId || '-'}</td>
                    <td>{item.sellerName}</td>
                    <td>
                      <span className="status-chip">{item.moderationStatus}</span>
                    </td>
                    <td className="actions-cell">
                      <button className="action-btn" onClick={() => controller.setSelectedProduct(item)}>
                        View
                      </button>
                      <button className="secondary-btn" onClick={() => controller.openEditProductForm(item)}>
                        Edit
                      </button>
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
                {controller.productResults.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      No products found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
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
        <article className="panel">
          <h3>Payout Requests</h3>
          <ul className="payout-list">
            {controller.payoutResults.map((item) => (
              <li key={item.id}>
                <div>
                  <p>{item.seller}</p>
                  <strong>{item.amount}</strong>
                </div>
                <button className="approve-btn" onClick={() => void controller.handleApprovePayout(item.id)}>
                  Approve
                </button>
              </li>
            ))}
            {controller.payoutResults.length === 0 ? (
              <li className="empty-payout">No pending payouts.</li>
            ) : null}
          </ul>
        </article>
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
                  <button className="secondary-btn" onClick={() => void controller.handleResolveReport(item.id)}>
                    Resolve
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
