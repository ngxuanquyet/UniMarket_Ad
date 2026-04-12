import { Dispatch, FormEvent, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react'
import { AdminUseCases } from '../../application/usecases/AdminUseCases'
import {
  AuthScreenState,
  PayoutItem,
  ProductModerationAction,
  ProductFormMode,
  ProductFormState,
  ProductItem,
  ReportItem,
  ScreenKey,
  UserItem,
  defaultDashboardStats,
  defaultProductFormState
} from '../../domain/entities/admin'

export type AdminController = ReturnType<typeof useAdminController>

export function useAdminController(useCases: AdminUseCases) {
  const [authScreenState, setAuthScreenState] = useState<AuthScreenState>('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError] = useState('')
  const [adminEmail, setAdminEmail] = useState('')

  const [stats, setStats] = useState(defaultDashboardStats)
  const [reports, setReports] = useState<ReportItem[]>([])
  const [payouts, setPayouts] = useState<PayoutItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])

  const [isDashboardLoading, setIsDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const [activeScreen, setActiveScreen] = useState<ScreenKey>('dashboard')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [processingUserIds, setProcessingUserIds] = useState<string[]>([])
  const [processingProductIds, setProcessingProductIds] = useState<string[]>([])
  const [processingReportIds, setProcessingReportIds] = useState<string[]>([])
  const [processingPayoutIds, setProcessingPayoutIds] = useState<string[]>([])
  const [isProductFormOpen, setIsProductFormOpen] = useState(false)
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [productFormMode, setProductFormMode] = useState<ProductFormMode>('create')
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [productForm, setProductForm] = useState<ProductFormState>(defaultProductFormState)

  const loadDashboardData = useCallback(async () => {
    setIsDashboardLoading(true)
    setDashboardError('')
    try {
      const data = await useCases.loadDashboardData()
      setStats(data.stats)
      setReports(data.reports)
      setPayouts(data.payouts)
      setUsers(data.users)
      setProducts(data.products)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load dashboard data.'
      setDashboardError(message)
      setStats(defaultDashboardStats)
      setReports([])
      setPayouts([])
      setUsers([])
      setProducts([])
    } finally {
      setIsDashboardLoading(false)
    }
  }, [useCases])

  useEffect(() => {
    if (!actionMessage) return
    const timeoutId = window.setTimeout(() => {
      setActionMessage('')
    }, 30_000)
    return () => window.clearTimeout(timeoutId)
  }, [actionMessage])

  useEffect(() => {
    const unsubscribe = useCases.observeAuthState(async (user) => {
      if (!user) {
        setAdminEmail('')
        setAuthScreenState('logged_out')
        return
      }

      try {
        const allowed = await useCases.hasAdminAccess(user)
        if (!allowed) {
          await useCases.logout()
          setAuthError('This account does not have admin/moderator access.')
          setAuthScreenState('logged_out')
          return
        }

        setAdminEmail(useCases.getAdminEmail(user))
        setAuthError('')
        setAuthScreenState('authenticated')
      } catch {
        await useCases.logout()
        setAuthError('Unable to verify permissions. Please sign in again.')
        setAuthScreenState('logged_out')
      }
    })

    return () => unsubscribe()
  }, [useCases])

  useEffect(() => {
    if (authScreenState === 'authenticated') {
      void loadDashboardData()
    }
  }, [authScreenState, loadDashboardData])

  const selectedReport = useMemo(
    () => reports.find((item) => item.id === selectedReportId) ?? null,
    [reports, selectedReportId]
  )

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || !password.trim()) {
      setAuthError('Please enter email and password.')
      return
    }

    setIsSubmitting(true)
    setAuthError('')

    try {
      const user = await useCases.login(email.trim(), password, rememberMe)
      const allowed = await useCases.hasAdminAccess(user)
      if (!allowed) {
        await useCases.logout()
        setAuthError('This account does not have admin/moderator access.')
        setAuthScreenState('logged_out')
        return
      }

      setAdminEmail(useCases.getAdminEmail(user))
      setAuthScreenState('authenticated')
    } catch (error) {
      setAuthError(useCases.mapSignInError(error))
      setAuthScreenState('logged_out')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await useCases.logout()
    setAuthScreenState('logged_out')
  }

  const handleResolveReport = async (reportId: string) => {
    if (processingReportIds.includes(reportId)) return
    setActionMessage('')
    setProcessingReportIds((prev) => [...prev, reportId])
    try {
      await useCases.resolveReport(reportId)
      setReports((prev) =>
        prev.map((item) => (item.id === reportId ? { ...item, status: 'Resolved' } : item))
      )
      setActionMessage('Report marked as resolved.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to resolve report.'
      setActionMessage(message)
    } finally {
      setProcessingReportIds((prev) => prev.filter((id) => id !== reportId))
    }
  }

  const handleApprovePayout = async (payoutId: string) => {
    if (processingPayoutIds.includes(payoutId)) return
    setActionMessage('')
    setProcessingPayoutIds((prev) => [...prev, payoutId])
    try {
      await useCases.approvePayout(payoutId)
      setPayouts((prev) =>
        prev.map((item) => (item.id === payoutId ? { ...item, status: 'APPROVED' } : item))
      )
      setActionMessage('Payout approved successfully.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to approve payout.'
      setActionMessage(message)
    } finally {
      setProcessingPayoutIds((prev) => prev.filter((id) => id !== payoutId))
    }
  }

  const handleToggleUserLock = async (userId: string, currentLocked: boolean) => {
    const nextLocked = !currentLocked
    setActionMessage('')
    setProcessingUserIds((prev) => [...prev, userId])
    try {
      await useCases.setUserLock(userId, nextLocked)
      setUsers((prev) => prev.map((item) => (item.id === userId ? { ...item, isLocked: nextLocked } : item)))
      setActionMessage(nextLocked ? `User ${userId} has been locked.` : `User ${userId} has been unlocked.`)
    } catch (error) {
      setActionMessage(useCases.mapActionError(error))
    } finally {
      setProcessingUserIds((prev) => prev.filter((id) => id !== userId))
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmed = window.confirm(`Delete user "${userName}" (${userId})?\nThis will remove login access.`)
    if (!confirmed) return

    setActionMessage('')
    setProcessingUserIds((prev) => [...prev, userId])
    try {
      await useCases.deleteUser(userId)
      setUsers((prev) => prev.filter((item) => item.id !== userId))
      setStats((prev) => ({ ...prev, totalUsers: Math.max(0, prev.totalUsers - 1) }))
      setActionMessage(`User ${userId} has been deleted.`)
    } catch (error) {
      setActionMessage(useCases.mapActionError(error))
    } finally {
      setProcessingUserIds((prev) => prev.filter((id) => id !== userId))
    }
  }

  const openCreateProductForm = () => {
    setProductFormMode('create')
    setEditingProductId(null)
    setProductForm(defaultProductFormState)
    setIsProductFormOpen(true)
  }

  const openEditProductForm = (item: ProductItem) => {
    setProductFormMode('edit')
    setEditingProductId(item.id)
    const mappedSpecs = Object.entries(item.specifications || {}).map(([key, value]) => ({
      key,
      value
    }))
    setProductForm({
      name: item.name,
      sellerId: item.sellerId,
      sellerName: item.sellerName === 'Unknown seller' ? '' : item.sellerName,
      moderationStatus: item.moderationStatus || 'PENDING',
      price: item.price == null ? '' : String(item.price),
      quantityAvailable: item.quantityAvailable == null ? '' : String(item.quantityAvailable),
      description: item.description,
      specifications: mappedSpecs.length > 0 ? mappedSpecs : [{ key: '', value: '' }],
      category: item.category,
      imageUrl: item.imageUrls[0] || ''
    })
    setIsProductFormOpen(true)
  }

  const closeProductForm = () => {
    setIsProductFormOpen(false)
    setEditingProductId(null)
    setProductForm(defaultProductFormState)
  }

  const handleSaveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = productForm.name.trim()
    const sellerId = productForm.sellerId.trim()
    if (!name || !sellerId) {
      setActionMessage('Name and seller ID are required.')
      return
    }

    setIsSavingProduct(true)
    setActionMessage('')
    try {
      const saved = await useCases.saveProduct({
        mode: productFormMode,
        productId: editingProductId ?? undefined,
        form: productForm
      })

      if (productFormMode === 'create') {
        setProducts((prev) => [saved, ...prev])
        if (saved.moderationStatus === 'PENDING') {
          setStats((prev) => ({ ...prev, pendingVerifications: prev.pendingVerifications + 1 }))
        }
        setActionMessage('Product created successfully.')
      } else if (editingProductId) {
        setProducts((prev) =>
          prev.map((item) =>
            item.id === editingProductId
              ? {
                  ...item,
                  ...saved,
                  createdAt: item.createdAt,
                  imageUrls: saved.imageUrls.length > 0 ? saved.imageUrls : item.imageUrls
                }
              : item
          )
        )
        setActionMessage('Product updated successfully.')
      }
      closeProductForm()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save product.'
      setActionMessage(message)
    } finally {
      setIsSavingProduct(false)
    }
  }

  const handleDeleteProduct = async (item: ProductItem) => {
    const confirmed = window.confirm(`Delete product "${item.name}" (${item.id})?`)
    if (!confirmed) return

    setProcessingProductIds((prev) => [...prev, item.id])
    setActionMessage('')
    try {
      await useCases.deleteProduct(item.id)
      setProducts((prev) => prev.filter((product) => product.id !== item.id))
      setSelectedProduct((prev) => (prev?.id === item.id ? null : prev))
      setStats((prev) => ({
        ...prev,
        pendingVerifications:
          item.moderationStatus === 'PENDING'
            ? Math.max(0, prev.pendingVerifications - 1)
            : prev.pendingVerifications
      }))
      setActionMessage(`Product ${item.id} has been deleted.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete product.'
      setActionMessage(message)
    } finally {
      setProcessingProductIds((prev) => prev.filter((id) => id !== item.id))
    }
  }

  const handleModerateProduct = async (
    item: ProductItem,
    action: ProductModerationAction,
    reason = ''
  ) => {
    setProcessingProductIds((prev) => [...prev, item.id])
    setActionMessage('')
    try {
      await useCases.moderateProduct(item.id, action, reason)
      const nextStatus =
        action === 'APPROVE' || action === 'ENABLE'
          ? 'APPROVED'
          : action === 'DISABLE'
            ? 'DISABLED'
            : 'REJECTED'
      setProducts((prev) =>
        prev.map((product) =>
          product.id === item.id
            ? {
                ...product,
                moderationStatus: nextStatus
              }
            : product
        )
      )
      setSelectedProduct((prev) =>
        prev?.id === item.id
          ? {
              ...prev,
              moderationStatus: nextStatus
            }
          : prev
      )
      if (item.moderationStatus === 'PENDING') {
        setStats((prev) => ({
          ...prev,
          pendingVerifications: Math.max(0, prev.pendingVerifications - 1)
        }))
      }
      setActionMessage(
        action === 'APPROVE'
          ? `Product ${item.id} has been approved.`
          : action === 'REJECT'
            ? `Product ${item.id} has been rejected.`
            : action === 'DISABLE'
              ? `Product ${item.id} has been disabled.`
              : `Product ${item.id} has been enabled.`
      )
    } catch (error) {
      setActionMessage(useCases.mapActionError(error))
    } finally {
      setProcessingProductIds((prev) => prev.filter((id) => id !== item.id))
    }
  }

  const reportResults = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return reports
    return reports.filter((item) =>
      [item.type, item.reporter, item.reason, item.status, item.details]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    )
  }, [reports, searchTerm])

  const userResults = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return users
    return users.filter((item) =>
      `${item.id} ${item.name} ${item.email} ${item.avatarUrl} ${item.walletBalance ?? ''}`
        .toLowerCase()
        .includes(keyword)
    )
  }, [users, searchTerm])

  const productResults = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return products
    return products.filter((item) =>
      `${item.id} ${item.name} ${item.sellerId} ${item.sellerName} ${item.moderationStatus}`
        .toLowerCase()
        .includes(keyword)
    )
  }, [products, searchTerm])

  const payoutResults = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return payouts
    return payouts.filter((item) =>
      `${item.seller} ${item.amount} ${item.status}`.toLowerCase().includes(keyword)
    )
  }, [payouts, searchTerm])

  const isActionLoading =
    isSavingProduct ||
    processingUserIds.length > 0 ||
    processingProductIds.length > 0 ||
    processingReportIds.length > 0 ||
    processingPayoutIds.length > 0

  return {
    authScreenState,
    email,
    password,
    rememberMe,
    isSubmitting,
    authError,
    adminEmail,
    stats,
    reports,
    payouts,
    users,
    products,
    isDashboardLoading,
    dashboardError,
    actionMessage,
    activeScreen,
    searchTerm,
    selectedReport,
    selectedProduct,
    processingUserIds,
    processingProductIds,
    processingReportIds,
    processingPayoutIds,
    isActionLoading,
    isProductFormOpen,
    isSavingProduct,
    productFormMode,
    productForm,
    reportResults,
    userResults,
    productResults,
    payoutResults,
    setEmail,
    setPassword,
    setRememberMe,
    setActionMessage,
    setActiveScreen,
    setSearchTerm,
    setSelectedProduct,
    setSelectedReportId,
    setProductForm: setProductForm as Dispatch<SetStateAction<ProductFormState>>,
    handleLogin,
    handleLogout,
    handleResolveReport,
    handleApprovePayout,
    handleToggleUserLock,
    handleDeleteUser,
    openCreateProductForm,
    openEditProductForm,
    closeProductForm,
    handleSaveProduct,
    handleDeleteProduct,
    handleModerateProduct
  }
}
