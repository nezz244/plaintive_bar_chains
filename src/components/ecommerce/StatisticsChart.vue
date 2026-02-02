<template>
  <div
    class="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6"
  >
    <!-- Header -->
    <div class="flex flex-col gap-5 mb-6 sm:flex-row sm:justify-between">
      <div class="w-full">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Monthly Bar Profit</h3>
        <p class="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
          Revenue of each bar per month
        </p>
      </div>
    </div>

    <!-- Chart -->
    <div class="max-w-full overflow-x-auto custom-scrollbar">
      <div id="chartBarsRevenue" class="-ml-4 min-w-[1000px] xl:min-w-full pl-2">
        <VueApexCharts type="area" height="350" :options="chartOptions" :series="series" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import VueApexCharts from 'vue3-apexcharts'

const bars = ['Dumms', 'Marleys', '4Jays', 'Bulawayo']
const series = ref<any[]>([])
const chartOptions = ref({
  chart: {
    type: 'area',
    toolbar: { show: false },
    fontFamily: 'Outfit, sans-serif',
  },
  stroke: { curve: 'smooth', width: 2 },
  fill: { gradient: { enabled: true, opacityFrom: 0.55, opacityTo: 0 } },
  markers: { size: 0 },
  xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  yaxis: { title: { text: 'Revenue' } },
  tooltip: { y: { formatter: val => `$${val.toFixed(2)}` } },
  colors: ['#465FFF', '#9CB9FF', '#FF7A45', '#FFC542'], // one color per bar
  legend: { position: 'top', horizontalAlign: 'left' },
  dataLabels: { enabled: false },
  grid: { yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } } },
})

/**
 * Fetch sales and expenses for each bar and compute monthly revenue
 */
async function fetchBarRevenue(barName: string) {
  try {
    const [salesRes, expensesRes] = await Promise.all([
      axios.get(`/api/${barName.toLowerCase()}/sales`),
      axios.get(`/api/${barName.toLowerCase()}/expenses`),
    ])

    const sales = salesRes.data
    const expenses = expensesRes.data

    // Initialize revenue by month
    const revenueByMonth = Array(12).fill(0)

    // Sum sales by month
    sales.forEach((s: any) => {
      const month = new Date(s.sale_time).getMonth() // 0 = Jan, 11 = Dec
      revenueByMonth[month] += Number(s.amount || 0)
    })

    // Subtract expenses by month
    expenses.forEach((e: any) => {
      const month = new Date(e.expense_date).getMonth()
      revenueByMonth[month] -= Number(e.amount || 0)
    })

    return { name: barName, data: revenueByMonth }
  } catch (err) {
    console.error(`Failed to fetch revenue for ${barName}`, err)
    return { name: barName, data: Array(12).fill(0) }
  }
}

onMounted(async () => {
  const barSeries = await Promise.all(bars.map(bar => fetchBarRevenue(bar)))
  series.value = barSeries
})
</script>

<style scoped>
.area-chart {
  width: 100%;
}
</style>
