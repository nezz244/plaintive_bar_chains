<template>
  <div class="space-y-6">

    <!-- RANGE FILTER -->
    <div class="flex gap-2">
      <button
        v-for="r in ranges"
        :key="r"
        @click="range = r"
        class="px-3 py-1 rounded-lg text-sm font-medium transition"
        :class="range === r
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'"
      >
        {{ r.toUpperCase() }}
      </button>
    </div>

    <!-- TABLE CARD -->
    <div
      class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4"
    >
      <h3 class="text-lg font-semibold mb-4 text-gray-800 dark:text-white/90">
        Best Selling Products
      </h3>

      <div class="overflow-x-auto">
        <table class="min-w-full">
          <thead>
          <tr class="border-b border-gray-100 dark:border-gray-800">
            <th class="py-2 text-left text-xs text-gray-500">Rank</th>
            <th class="py-2 text-left text-xs text-gray-500">Product</th>
            <th class="py-2 text-left text-xs text-gray-500">Units Sold</th>
            <th class="py-2 text-left text-xs text-gray-500">Revenue</th>
            <th class="py-2 text-left text-xs text-gray-500">Growth</th>
          </tr>
          </thead>

          <tbody>
          <tr
            v-for="(p, i) in sortedProducts"
            :key="p.name"
            class="border-b border-gray-100 dark:border-gray-800"
          >
            <td class="py-2">{{ rankLabel(i) }}</td>
            <td class="py-2 font-medium">{{ p.name }}</td>
            <td class="py-2 text-gray-500">{{ p.units_sold }}</td>
            <td class="py-2 font-medium">{{ formatCurrency(p.revenue) }}</td>
            <td class="py-2">
              <span
                class="text-sm font-medium"
                :class="p.growth >= 0
                  ? 'text-green-600'
                  : 'text-red-600'"
              >
                {{ p.growth >= 0 ? '▲' : '▼' }} {{ Math.abs(p.growth) }}%
              </span>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- CHARTS -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

      <!-- BAR CHART -->
      <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4">
        <h4 class="font-semibold mb-2">Units Sold</h4>
        <VueApexCharts
          type="bar"
          height="320"
          :options="barOptions"
          :series="barSeries"
        />
      </div>

      <!-- PIE CHART -->
      <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4">
        <h4 class="font-semibold mb-2">Contribution</h4>
        <VueApexCharts
          type="pie"
          height="320"
          :options="pieOptions"
          :series="pieSeries"
        />
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

/* ---------------- STATE ---------------- */

const ranges = ['daily', 'weekly', 'monthly']
const range = ref('monthly')

const rawProducts = ref<any[]>([])

/* ---------------- FETCH ---------------- */

async function fetchProducts() {
  try {
    const res = await fetch(
      `http://localhost:3000/api/products/performance?range=${range.value}`
    )
    if (!res.ok) throw new Error(`HTTP error ${res.status}`)
    rawProducts.value = await res.json()
    console.log('Fetched products:', rawProducts.value)
  } catch (err) {
    console.error('Failed to fetch products', err)
    rawProducts.value = []
  }
}

watch(range, fetchProducts, { immediate: true })

/* ---------------- NORMALIZE DATA ---------------- */

const sortedProducts = computed(() => {
  return rawProducts.value
    .map(p => {
      const current = Number(p.current_sold ?? p.total_sold) || 0
      const previous = Number(p.previous_sold ?? 0)
      const revenue = Number(p.current_revenue ?? p.total_revenue) || 0

      const growth =
        previous === 0
          ? current > 0 ? 100 : 0
          : ((current - previous) / previous) * 100

      return {
        name: p.product,
        units_sold: current,
        revenue,
        growth: Number(growth.toFixed(1)),
      }
    })
    .sort((a, b) => b.units_sold - a.units_sold)
})

/* ---------------- BAR CHART ---------------- */

const barSeries = computed(() => [
  { name: 'Units Sold', data: sortedProducts.value.map(p => p.units_sold) },
])

const barOptions = computed(() => ({
  chart: { toolbar: { show: false } },
  plotOptions: { bar: { borderRadius: 6 } },
  xaxis: { categories: sortedProducts.value.map(p => p.name) },
  colors: ['#6366f1'],
  dataLabels: { enabled: false },
}))

/* ---------------- PIE CHART ---------------- */

const totalUnits = computed(() =>
  sortedProducts.value.reduce((s, p) => s + p.units_sold, 0)
)

const pieSeries = computed(() =>
  sortedProducts.value.map(p =>
    Number(((p.units_sold / totalUnits.value) * 100).toFixed(1))
  )
)

const pieOptions = computed(() => ({
  labels: sortedProducts.value.map(p => p.name),
  legend: { position: 'bottom' },
}))

/* ---------------- HELPERS ---------------- */

function rankLabel(i: number) {
  if (i === 0) return '🥇 #1'
  if (i === 1) return '🥈 #2'
  if (i === 2) return '🥉 #3'
  return `#${i + 1}`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(value)
}
</script>
