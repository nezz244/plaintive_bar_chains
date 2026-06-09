import api from './client'

export const companiesApi = {
  getCurrent: () => api.get('/companies/current'),
  updateCurrent: (data: Record<string, unknown>) => api.put('/companies/current', data),
  getDashboard: () => api.get('/companies/dashboard'),
}

export const branchesApi = {
  list: () => api.get('/branches'),
  get: (id: number) => api.get(`/branches/${id}`),
  create: (data: Record<string, unknown>) => api.post('/branches', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/branches/${id}`, data),
  deactivate: (id: number) => api.delete(`/branches/${id}`),
}

export const usersApi = {
  list: () => api.get('/users'),
  create: (data: Record<string, unknown>) => api.post('/users', data),
  updateAccess: (userId: number, branchAccess: unknown[]) =>
    api.put(`/users/${userId}/access`, { branchAccess }),
  updateStatus: (userId: number, isActive: boolean) =>
    api.put(`/users/${userId}/status`, { isActive }),
  listEmployees: (branchId?: number) =>
    api.get('/users/employees/list', { params: branchId ? { branchId } : {} }),
  createEmployee: (data: Record<string, unknown>) => api.post('/users/employees', data),
  updateEmployee: (id: number, data: Record<string, unknown>) =>
    api.put(`/users/employees/${id}`, data),
}

export const posApi = {
  getContext: (branchId: number) => api.get(`/pos/${branchId}/context`),
  getProducts: (branchId: number) => api.get(`/pos/${branchId}/products`),
  createOrder: (branchId: number, data: Record<string, unknown>) =>
    api.post(`/pos/${branchId}/orders`, data),
  voidOrder: (branchId: number, orderId: number, data: Record<string, unknown>) =>
    api.post(`/pos/${branchId}/orders/${orderId}/void`, data),
  refundOrder: (branchId: number, orderId: number, data: Record<string, unknown>) =>
    api.post(`/pos/${branchId}/orders/${orderId}/refund`, data),
  verifyPin: (branchId: number, pinCode: string) =>
    api.post(`/pos/${branchId}/verify-pin`, { pinCode }),
  getTodayOrders: (branchId: number) => api.get(`/pos/${branchId}/orders/today`),
  getReceipt: (orderId: number) => api.get(`/pos/orders/${orderId}/receipt`),
  createProduct: (data: Record<string, unknown>) => api.post('/pos/products', data),
}

export const tablesApi = {
  list: (branchId: number) => api.get(`/tables/${branchId}`),
  create: (branchId: number, data: Record<string, unknown>) => api.post(`/tables/${branchId}`, data),
  update: (branchId: number, tableId: number, data: Record<string, unknown>) =>
    api.put(`/tables/${branchId}/${tableId}`, data),
  listTabs: (branchId: number) => api.get(`/tables/${branchId}/tabs`),
  getTab: (branchId: number, tabId: number) => api.get(`/tables/${branchId}/tabs/${tabId}`),
  openTab: (branchId: number, data: Record<string, unknown>) =>
    api.post(`/tables/${branchId}/tabs`, data),
  settleTab: (branchId: number, tabId: number, data: Record<string, unknown>) =>
    api.post(`/tables/${branchId}/tabs/${tabId}/settle`, data),
  closeTab: (branchId: number, tabId: number) =>
    api.post(`/tables/${branchId}/tabs/${tabId}/close`),
}

export const shiftsApi = {
  getCurrent: (branchId: number) => api.get(`/shifts/${branchId}/current`),
  list: (branchId: number) => api.get(`/shifts/${branchId}`),
  open: (branchId: number, data: Record<string, unknown>) =>
    api.post(`/shifts/${branchId}/open`, data),
  switchEmployee: (branchId: number, data: Record<string, unknown>) =>
    api.post(`/shifts/${branchId}/switch-employee`, data),
  close: (branchId: number, shiftId: number, data: Record<string, unknown>) =>
    api.post(`/shifts/${branchId}/${shiftId}/close`, data),
  getStockAudit: (branchId: number, shiftId: number) =>
    api.get(`/shifts/${branchId}/${shiftId}/stock-audit`),
  approveStock: (branchId: number, shiftId: number, data?: Record<string, unknown>) =>
    api.post(`/shifts/${branchId}/${shiftId}/approve-stock`, data || {}),
}

export const kitchenApi = {
  getOrders: (branchId: number) => api.get(`/kitchen/${branchId}/orders`),
  updateOrderStatus: (branchId: number, orderId: number, kitchenStatus: string) =>
    api.patch(`/kitchen/${branchId}/orders/${orderId}/status`, { kitchenStatus }),
  updateItemStatus: (branchId: number, itemId: number, kitchenStatus: string) =>
    api.patch(`/kitchen/${branchId}/items/${itemId}/status`, { kitchenStatus }),
}

export const paymentsApi = {
  getConfig: () => api.get('/payments/config'),
  updateConfig: (data: Record<string, unknown>) => api.put('/payments/config', data),
  charge: (data: { token: string; amountInCents: number; currency?: string }) =>
    api.post('/payments/charge', data),
}

export const expensesApi = {
  list: (params?: Record<string, unknown>) => api.get('/expenses', { params }),
  create: (data: Record<string, unknown>) => api.post('/expenses', data),
  remove: (id: number) => api.delete(`/expenses/${id}`),
}

export const stockApi = {
  get: (branchId: number) => api.get(`/stock/${branchId}`),
  transfer: (branchId: number, data: Record<string, unknown>) =>
    api.post(`/stock/${branchId}/transfer`, data),
  adjust: (branchId: number, data: Record<string, unknown>) =>
    api.post(`/stock/${branchId}/adjust`, data),
  reconciliation: (branchId: number, params?: Record<string, unknown>) =>
    api.get(`/stock/${branchId}/reconciliation`, { params }),
}

export const reportsApi = {
  profitAndLoss: (params?: Record<string, unknown>) => api.get('/reports/pl', { params }),
  stockAudit: (params?: Record<string, unknown>) => api.get('/reports/stock-audit', { params }),
}
