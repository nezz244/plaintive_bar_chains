<template>
  <div
    class="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6"
  >
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Monthly Sales without expenses</h3>

      <div class="relative h-fit">
        <DropdownMenu :menu-items="menuItems">
          <template #icon>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M10.2441 6C10.2441 5.0335 11.0276 4.25 11.9941 4.25H12.0041C12.9706 4.25 13.7541 5.0335 13.7541 6C13.7541 6.9665 12.9706 7.75 12.0041 7.75H11.9941C11.0276 7.75 10.2441 6.9665 10.2441 6ZM10.2441 18C10.2441 17.0335 11.0276 16.25 11.9941 16.25H12.0041C12.9706 16.25 13.7541 17.0335 13.7541 18C13.7541 18.9665 12.9706 19.75 12.0041 19.75H11.9941C11.0276 19.75 10.2441 18.9665 10.2441 18ZM11.9941 10.25C11.0276 10.25 10.2441 11.0335 10.2441 12C10.2441 12.9665 11.0276 13.75 11.9941 13.75H12.0041C12.9706 13.75 13.7541 12.9665 13.7541 12C13.7541 11.0335 12.9706 10.25 12.0041 10.25H11.9941Z"
                fill="currentColor"
              />
            </svg>
          </template>
        </DropdownMenu>
      </div>
    </div>

    <div class="max-w-full overflow-x-auto custom-scrollbar">
      <div id="chartOne" class="-ml-5 min-w-[650px] xl:min-w-full pl-2">
        <VueApexCharts type="bar" height="250" :options="chartOptions" :series="series" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import DropdownMenu from '../common/DropdownMenu.vue'
import VueApexCharts from 'vue3-apexcharts'

const menuItems = [
  { label: 'View More', onClick: () => console.log('View More clicked') },
  { label: 'Delete', onClick: () => console.log('Delete clicked') },
]

type Sale = {
  employee: string
  product: string
  quantity: number
  unit_price: number
  amount: number
  sale_time: string
}

const bars = ['dumms', 'marleys', '4jays', 'bulawayo'] // list of bar slugs
const series = ref<Array<{ name: string; data: number[] }>>([])

const chartOptions = ref({
  colors: ['#465FFF', '#9CB9FF', '#FF9C6E', '#36C5F0'],
  chart: {
    fontFamily: 'Outfit, sans-serif',
    type: 'bar',
    stacked: false,
    toolbar: { show: false },
  },
  plotOptions: {
    bar: { horizontal: false, columnWidth: '45%', borderRadius: 5 },
  },
  dataLabels: { enabled: false },
  stroke: { show: true, width: 2, colors: ['transparent'] },
  xaxis: {
    categories: [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ],
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  legend: { show: true, position: 'top', horizontalAlign: 'left' },
  yaxis: { title: false },
  grid: { yaxis: { lines: { show: true } } },
  fill: { opacity: 1 },
  tooltip: {
    y: { formatter: (val: number) => val.toString() },
  },
})

async function fetchMonthlySales() {
  const monthlyData: Array<{ name: string; data: number[] }> = []

  for (const bar of bars) {
    const { data: sales } = await axios.get<Sale[]>(`/api/${bar}/sales`)

    // Initialize 12 months with 0
    const monthlyTotals = Array(12).fill(0)

    sales.forEach((sale) => {
      const month = new Date(sale.sale_time).getMonth() // 0-11
      monthlyTotals[month] += Number(sale.amount) // ensure numeric
    })

    monthlyData.push({ name: bar.charAt(0).toUpperCase() + bar.slice(1), data: monthlyTotals })
  }

  series.value = monthlyData
}

onMounted(() => {
  fetchMonthlySales()
})
</script>
