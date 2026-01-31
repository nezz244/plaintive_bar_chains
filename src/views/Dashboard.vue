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
          <option v-for="m in 12" :key="m" :value="m">
            {{ m }}
          </option>
        </select>

        <select v-model="year" class="input">
          <option v-for="y in years" :key="y" :value="y">
            {{ y }}
          </option>
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
    <StockTable :stock="stock" />

    <!-- SALES -->
    <SalesTable :sales="sales" />

    <!-- EMPLOYEE RANKING -->
    <EmployeeRankingChart
      :data="employeeRanking"
      :month="month"
      :year="year"
    />

    <!-- BEST PRODUCTS -->
    <BestSellingProductsTable :products="bestProducts" />

    <!-- SHIFTS -->
    <ShiftTable
      :shifts="shifts"
      @handover="handoverCash"
    />

    <!-- EXPENSES -->
    <ExpensesTable
      :expenses="expenses"
      @add="addExpense"
    />

  </div>
</template>


<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
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
const barSlug = route.params.bar as string

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

/* LOAD DASHBOARD */
async function loadDashboard() {
  try {
    const [
      stockRes,
      salesRes,
      rankingRes,
      productsRes,
      shiftsRes,
      expensesRes
    ] = await Promise.all([
      dashboardApi.getBarStock(barSlug),
      dashboardApi.getBarSales(barSlug),
      dashboardApi.getEmployeeRanking(barSlug, month.value, year.value),
      dashboardApi.getBestProducts(barSlug),
      dashboardApi.getShifts(barSlug),
      dashboardApi.getExpenses(barSlug)
    ])

    stock.value = stockRes.data
    sales.value = salesRes.data
    employeeRanking.value = rankingRes.data
    bestProducts.value = productsRes.data
    shifts.value = shiftsRes.data
    expenses.value = expensesRes.data

  } catch (err) {
    console.error('Dashboard load failed', err)
  }
}

/* CASH HANDOVER */
async function handoverCash(shiftId: number) {
  await dashboardApi.handoverCash(barSlug, shiftId)
  loadDashboard()
}

/* ADD EXPENSE */
async function addExpense(payload: {
  category: string
  amount: number
  expense_date: string
}) {
  await dashboardApi.addExpense(barSlug, payload)
  loadDashboard()
}

/* AUTO LOAD */
onMounted(loadDashboard)

/* BAR CHANGE (route change) */
watch(
  () => route.params.bar,
  () => loadDashboard()
)
</script>

<style scoped>
.input {
  @apply border rounded-xl px-3 py-2 bg-white dark:bg-gray-800;
}
</style>
