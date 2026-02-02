<template>
  <div
    class="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-4 pt-4
           dark:border-gray-800 dark:bg-white/[0.03] sm:px-6"
  >
    <!-- Header -->
    <div class="mb-4 flex justify-between">
      <div>
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">
          Employee Ranking
        </h3>
        <p class="text-theme-xs text-gray-500 dark:text-gray-400">
          Top performing: {{ topEmployeeName }}
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="min-h-[200px] flex items-center justify-center text-gray-400 text-theme-sm"
    >
      Loading...
    </div>

    <!-- No data -->
    <div
      v-else-if="topEmployees.length === 0"
      class="min-h-[200px] flex items-center justify-center text-gray-400 text-theme-sm"
    >
      No employee ranking data available.
    </div>

    <!-- Chart -->
    <VueApexCharts
      v-else
      type="line"
      height="300"
      :options="chartOptions"
      :series="chartSeries"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

interface EmployeeData {
  name: string
  total_sales: string | number
}

const props = defineProps<{
  data?: EmployeeData[]
}>()

// ---------------- Loading ----------------
const loading = computed(() => !props.data)

// ---------------- Top employees ----------------
const topEmployees = computed(() => {
  if (!props.data) return []

  return [...props.data]
    .map(e => ({
      name: e.name,
      total_sales: Number(e.total_sales) || 0,
    }))
    .sort((a, b) => b.total_sales - a.total_sales)
    .slice(0, 5)
})

// ---------------- Top employee name ----------------
const topEmployeeName = computed(() => {
  if (topEmployees.value.length === 0) return 'N/A'
  return topEmployees.value[0].name
})

// ---------------- Apex Series ----------------
const chartSeries = computed(() => [
  {
    name: 'Total Sales',
    data: topEmployees.value.map(e => e.total_sales),
  },
])

// ---------------- Apex Options ----------------
const chartOptions = computed(() => ({
  chart: {
    type: 'line',
    toolbar: { show: false },
    zoom: { enabled: false },
  },
  stroke: {
    curve: 'smooth',
    width: 3,
  },
  dataLabels: { enabled: false },
  markers: { size: 5 },
  xaxis: {
    categories: topEmployees.value.map(e => e.name),
    labels: { style: { fontSize: '12px' } },
  },
  yaxis: {
    labels: { formatter: (val: number) => `$${val.toFixed(0)}` },
  },
  tooltip: {
    y: { formatter: (val: number) => `$${val.toFixed(2)}` },
  },
  colors: ['#4f46e5'],
}))
</script>
