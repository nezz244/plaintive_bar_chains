import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
})

export const dashboardApi = {

  /* OLD DASHBOARD (optional — keep if still used) */
  getEmployees: () => api.get('/dashboard/employees'),
  getProducts: () => api.get('/dashboard/products'),
  getOverview: () => api.get('/dashboard/overview'),
  getDailySales: () => api.get('/dashboard/daily-sales'),


  // --- NEW: bar-specific employees ---
  getBarEmployees: (bar: string) => axios.get(`/api/bars/${bar}/employees`),

  // --- NEW: record sale ---
  recordSale: (
    bar: string,
    payload: {
      product_id: number
      employee_id: number
      quantity: number
      unit_price: number
    }
  ) => axios.post(`/api/bars/${bar}/sales`, payload),

  /* BAR DASHBOARD */
  getBarStock: (bar: string) =>
    api.get(`/bars/${bar}/stock`),

  getBarSales: (bar: string) =>
    api.get(`/bars/${bar}/sales`),

  getEmployeeRanking: (
    bar: string,
    month: number,
    year: number
  ) =>
    api.get(`/bars/${bar}/employee-ranking`, {
      params: { month, year }
    }),

  getBestProducts: (bar: string) =>
    api.get(`/bars/${bar}/best-products`),

  getShifts: (bar: string) =>
    api.get(`/bars/${bar}/shifts`),

  getExpenses: (bar: string) =>
    api.get(`/bars/${bar}/expenses`),

  addExpense: (
    bar: string,
    payload: {
      category: string
      amount: number
      expense_date: string
    }
  ) =>
    api.post(`/bars/${bar}/expenses`, payload),

  handoverCash: (bar: string, shiftId: number) =>
    api.post(`/bars/${bar}/handover`, {
      shift_id: shiftId
    })
}
