<template>
  <div
    class="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6"
  >
    <div class="flex flex-col gap-5 mb-6 sm:flex-row sm:justify-between">
      <div class="w-full">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Performance</h3>
        <p class="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
          Target you’ve set for each month
        </p>
      </div>

      <div class="relative">
        <div class="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900">
          <button
            v-for="option in options"
            :key="option.value"
            @click="selected = option.value"
            :class="[
              selected === option.value
                ? 'shadow-theme-xs text-gray-900 dark:text-white bg-white dark:bg-gray-800'
                : 'text-gray-500 dark:text-gray-400',
              'px-3 py-2 font-medium rounded-md text-theme-sm hover:text-gray-900 hover:shadow-theme-xs dark:hover:bg-gray-800 dark:hover:text-white',
            ]"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-full overflow-x-auto custom-scrollbar">
      <div id="chartThree" class="-ml-4 min-w-[1000px] xl:min-w-full pl-2">
        <VueApexCharts type="area" height="310" :options="chartOptions" :series="series" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

// Chart options
const options = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
]
const selected = ref('monthly')

// TypeScript types for API response
interface RevenueData {
  month: string
  sales: number
  revenue: number
}

const series = ref<{ name: string; data: number[] }[]>([
  { name: 'Sales', data: [] },
  { name: 'Revenue', data: [] },
])

const chartOptions = ref({
  legend: { show: false, position: 'top', horizontalAlign: 'left' },
  colors: ['#465FFF', '#9CB9FF'],
  chart: { fontFamily: 'Outfit, sans-serif', type: 'area', toolbar: { show: false } },
  fill: { gradient: { enabled: true, opacityFrom: 0.55, opacityTo: 0 } },
  stroke: { curve: 'straight', width: [2, 2] },
  markers: { size: 0 },
  labels: { show: false, position: 'top' },
  grid: { xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
  dataLabels: { enabled: false },
  tooltip: { x: { format: 'dd MMM yyyy' } },
  xaxis: {
    type: 'category',
    categories: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    axisBorder: { show: false },
    axisTicks: { show: false },
    tooltip: { enabled: false },
  },
  yaxis: { title: { style: { fontSize: '0px' } } },
})

// Fetch revenue from API
const apiEndpoint = 'https://your-api.com/revenue?bar=Dumms'
const fetchRevenue = async () => {
  try {
    const res = await fetch(apiEndpoint)
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
    const data: RevenueData[] = await res.json()
    // Map API data to chart series
    series.value = [
      { name: 'Sales', data: data.map(d => d.sales) },
      { name: 'Revenue', data: data.map(d => d.revenue) },
    ]
    chartOptions.value.xaxis.categories = data.map(d => d.month)
  } catch (err: unknown) {
    console.error('Failed to load revenue', err)
  }
}

onMounted(() => {
  fetchRevenue()
})
</script>
