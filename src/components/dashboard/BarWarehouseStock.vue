<template>
  <div class="rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/[0.03]">
    <!-- Header -->
    <div class="px-5 pt-5 bg-white shadow-default rounded-2xl pb-11 dark:bg-gray-900 sm:px-6 sm:pt-6">
      <div class="flex justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">
            {{ barName }} Stock
          </h3>

          <p class="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Total Value: {{ formatCurrency(totalStockValue) }}
          </p>

          <p class="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Total Bottles: {{ totalBottles }}
          </p>
        </div>

        <DropdownMenu :menu-items="menuItems">
          <template #icon>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
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

      <!-- Radial Chart -->
      <div class="relative max-h-[195px]">
        <VueApexCharts
          type="radialBar"
          height="330"
          :options="chartOptions"
          :series="[warehouseStockPercentage]"
        />

        <span
          class="absolute left-1/2 top-[85%] -translate-x-1/2 -translate-y-[85%]
                 rounded-full bg-success-50 px-3 py-1 text-xs font-medium
                 text-success-600 dark:bg-success-500/15 dark:text-success-500"
        >
          {{ warehouseStockPercentage.toFixed(2) }}%
        </span>
      </div>
    </div>

    <!-- Individual Stock Items -->
    <div class="px-6 py-5">
      <div
        v-for="item in warehouseStock"
        :key="item.product_id"
        class="flex justify-between py-1 border-b border-gray-200 dark:border-gray-800"
      >
        <p class="text-gray-700 dark:text-gray-300">{{ item.product }}</p>

        <div class="text-right">
          <p class="font-semibold text-gray-900 dark:text-white">
            {{ casesFromBottles(item) }} cases
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ item.units_available }} bottles
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRef } from 'vue'
import DropdownMenu from '../common/DropdownMenu.vue'
import VueApexCharts from 'vue3-apexcharts'

// ---------------- Props ----------------
const props = defineProps<{ barName: string }>()
const barNameRef = toRef(props, 'barName')

// ---------------- Types ----------------
interface StockItem {
  product_id: number
  product: string
  units_available: number // bottles
  buying_price: number
  selling_price: number
  units_per_case: number
}

// ---------------- State ----------------
const warehouseStock = ref<StockItem[]>([])

const menuItems = [
  { label: 'View More', onClick: () => console.log('View More clicked') },
  { label: 'Delete', onClick: () => console.log('Delete clicked') },
]

// ---------------- Helpers ----------------
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'USD' }).format(value)

const casesFromBottles = (item: StockItem) => {
  if (!item.units_per_case || item.units_per_case <= 0) {
    console.warn('⚠️ Invalid units_per_case:', item)
    return 0
  }
  return Math.floor(item.units_available / item.units_per_case)
}

// ---------------- Fetch ----------------
async function fetchWarehouseStock(bar: string) {
  try {
    console.log('🟡 Fetching stock for:', bar)

    const res = await fetch(`http://localhost:3000/api/bars/${bar.toLowerCase()}/stock`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const raw = await res.json()
    console.log('🟢 Raw stock response:', raw)

    // ✅ SANITIZE EVERYTHING
    warehouseStock.value = raw.map((i: any) => ({
      product_id: Number(i.product_id),
      product: i.product,
      units_available: Number(i.bottles_available) || 0, // 🔥 FIX HERE
      buying_price: Number(i.buying_price) || 0,
      selling_price: Number(i.selling_price) || 0,
      units_per_case: Number(i.units_per_case) || 1,
    }))


    console.log(
      '🧼 Sanitized stock:',
      warehouseStock.value.map(i => ({
        product: i.product,
        bottles: i.units_available,
        units_per_case: i.units_per_case,
        cases: casesFromBottles(i),
        types: {
          bottles: typeof i.units_available,
          per_case: typeof i.units_per_case,
        },
      }))
    )
  } catch (err) {
    console.error('🔴 Stock fetch failed', err)
    warehouseStock.value = []
  }
}

// ---------------- Watch ----------------
watch(
  barNameRef,
  bar => bar && fetchWarehouseStock(bar),
  { immediate: true }
)

// ---------------- Computed ----------------
const totalBottles = computed(() =>
  warehouseStock.value.reduce((sum, i) => sum + i.units_available, 0)
)

const totalStockValue = computed(() =>
  warehouseStock.value.reduce(
    (sum, i) => sum + i.units_available * i.buying_price,
    0
  )
)

const warehouseStockPercentage = computed(() => {
  const maxBottles = warehouseStock.value.length * 200
  if (!maxBottles) return 0

  const pct = (totalBottles.value / maxBottles) * 100
  return Number.isFinite(pct) ? pct : 0
})

// ---------------- ApexCharts ----------------
const chartOptions = {
  colors: ['#465FFF'],
  chart: { sparkline: { enabled: true } },
  plotOptions: {
    radialBar: {
      startAngle: -90,
      endAngle: 90,
      hollow: { size: '80%' },
      dataLabels: {
        name: { show: false },
        value: {
          fontSize: '36px',
          formatter: (val: number) => val.toFixed(2) + '%',
        },
      },
    },
  },
}
</script>
