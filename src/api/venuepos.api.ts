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
  openTab: (branchId: number, data: Record<string, unknown>) =>
    api.post(`/tables/${branchId}/tabs`, data),
  closeTab: (branchId: number, tabId: number) =>
    api.post(`/tables/${branchId}/tabs/${tabId}/close`),
}

export const shiftsApi = {
  getCurrent: (branchId: number) => api.get(`/shifts/${branchId}/current`),
  list: (branchId: number) => api.get(`/shifts/${branchId}`),
  open: (branchId: number, data: Record<string, unknown>) =>
    api.post(`/shifts/${branchId}/open`, data),
  close: (branchId: number, shiftId: number, data: Record<string, unknown>) =>
    api.post(`/shifts/${branchId}/${shiftId}/close`, data),
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
