<template>
  <div class="space-y-8">

    <!-- HEADER -->
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold capitalize">
        {{ barSlug }} Bar Dashboard
      </h2>

      <!-- Month / Year Filter -->
      <div class="flex gap-3">
        <select v-model="month" class="input">
          <option v-for="m in 12" :key="m" :value="m">{{ m }}</option>
        </select>

        <select v-model="year" class="input">
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>

        <button
          class="px-4 py-2 bg-primary text-white rounded-xl"
          @click="loadDashboard"
        >
          Apply
        </button>
      </div>
    </div>

    <!-- STOCK -->
    <StockTable :stock="stock" :bar-name="barSlug" />

    <!-- SALES -->
    <SalesTable
      :sales="sales"
      :products="stock"
      :employees="employees"
      :bar-slug="barSlug"
    />


    <EmployeeRankingChart :data="employeeRanking" />

    <!-- BEST PRODUCTS -->
    <BestSellingProductsTable :products="bestProducts" />

    <!-- SHIFTS -->
    <ShiftTable :shifts="shifts" @handover="handoverCash" />

    <!-- EXPENSES -->
    <ExpensesTable :expenses="expenses" @add="addExpense" />

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { dashboardApi } from '@/api/dashboard.api'

/* COMPONENTS */
import StockTable from '@/components/dashboard/BarWarehouseStock.vue'
import SalesTable from '@/components/dashboard/SalesTable.vue'
import EmployeeRankingChart from '@/components/dashboard/EmployeeRankingChart.vue'
import BestSellingProductsTable from '@/components/dashboard/BestSellingProductsTable.vue'
import ShiftTable from '@/components/dashboard/ShiftTable.vue'
import ExpensesTable from '@/components/dashboard/ExpensesTable.vue'

/* ROUTE */
const route = useRoute()
const barSlug = ref(route.params.bar as string)
const barId = ref(1) // You can map slug to ID via API if needed

/* FILTERS */
const month = ref(new Date().getMonth() + 1)
const year = ref(new Date().getFullYear())
const years = Array.from({ length: 5 }, (_, i) => year.value - i)

/* STATE */
const stock = ref([])
const sales = ref([])
const employeeRanking = ref([])
const bestProducts = ref([])
const shifts = ref([])
const expenses = ref([])
const products = ref([]) // products available for sale
const employees = ref([]) // employees on shift

/* LOAD DASHBOARD */
async function loadDashboard() {
  try {
    const [
      stockRes,
      salesRes,
      rankingRes,
      productsRes,
      shiftsRes,
      expensesRes,
      employeesRes
    ] = await Promise.all([
      dashboardApi.getBarStock(barSlug.value),
      dashboardApi.getBarSales(barSlug.value),
      dashboardApi.getEmployeeRanking(barSlug.value, month.value, year.value),
      dashboardApi.getBestProducts(barSlug.value),
      dashboardApi.getShifts(barSlug.value),
      dashboardApi.getExpenses(barSlug.value),
      dashboardApi.getBarEmployees(barSlug.value) // <-- fetch employees
    ])

    stock.value = stockRes.data
    sales.value = salesRes.data
    employeeRanking.value = rankingRes.data
    bestProducts.value = productsRes.data
    products.value = productsRes.data
    shifts.value = shiftsRes.data
    expenses.value = expensesRes.data
    employees.value = employeesRes.data

  } catch (err) {
    console.error('Dashboard load failed', err)
  }
}

/* CASH HANDOVER */
async function handoverCash(shiftId: number) {
  await dashboardApi.handoverCash(barSlug.value, shiftId)
  await loadDashboard()
}

/* ADD EXPENSE */
async function addExpense(payload: {
  category: string
  amount: number
  expense_date: string
}) {
  await dashboardApi.addExpense(barSlug.value, payload)
  await loadDashboard()
}

/* RECORD SALE HANDLER */
async function handleRecordSale(payload: {
  product_id: number
  employee_id: number
  quantity: number
  unit_price: number
}) {
  try {
    await dashboardApi.recordSale(barSlug.value, payload)
    await loadDashboard()
  } catch (err) {
    console.error('Failed to record sale', err)
  }
}

/* AUTO LOAD */
onMounted(loadDashboard)

/* BAR CHANGE (route change) */
watch(
  () => route.params.bar,
  (newBar) => {
    barSlug.value = newBar as string
    loadDashboard()
  }
)
</script>
