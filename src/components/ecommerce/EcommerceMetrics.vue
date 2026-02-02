<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
    <div
      v-for="bar in barsWithRevenue"
      :key="bar.name"
      class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
      @click="openBar(bar.name)"
    >
      <!-- Icon -->
      <div class="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
        <svg
          class="fill-gray-800 dark:fill-white/90"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <!-- You can add different icons per bar if needed -->
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M8.80443 5.60156C7.59109 5.60156 6.60749 6.58517 6.60749 7.79851C6.60749 9.01185 7.59109 9.99545 8.80443 9.99545C10.0178 9.99545 11.0014 9.01185 11.0014 7.79851C11.0014 6.58517 10.0178 5.60156 8.80443 5.60156Z"
            fill=""
          />
        </svg>
      </div>

      <!-- Revenue & Growth -->
      <div class="flex items-end justify-between mt-5">
        <div>
          <span class="text-sm text-gray-500 dark:text-gray-400">{{ bar.name }}</span>
          <h4 class="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">$
            {{ bar.currentRevenue.toLocaleString() }}
          </h4>
        </div>

        <span
          :class="[
            'flex items-center gap-1 rounded-full py-0.5 pl-2 pr-2.5 text-sm font-medium',
            bar.growthPercentage >= 0
              ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500'
              : 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
          ]"
        >
          <svg class="fill-current" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              v-if="bar.growthPercentage >= 0"
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M5.56462 1.62393L9.65514 4.5918L8.59486 5.65283L6.12329 3.93247V10.125"
              fill=""
            />
            <path
              v-else
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M5.31462 10.3761L9.40514 7.4082L8.34486 6.34717L6.62329 8.06753V1.875"
              fill=""
            />
          </svg>
          {{ Math.abs(bar.growthPercentage).toFixed(2) }}%
        </span>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
function openBar(barName: string) {
  router.push({ name: 'BarDashboard', params: { bar: barName.toLowerCase() } })
}

// Your bar list
const barList = ref([
  { name: 'Dumms' },
  { name: 'Marleys' },
  { name: '4Jays' },
  { name: 'Bulawayo' },
])

// Store sales and expenses for all bars
const salesMap = ref<Record<string, any[]>>({})
const expensesMap = ref<Record<string, any[]>>({})

// Fetch data for each bar
async function fetchBarData(barName: string) {
  try {
    const [salesRes, expensesRes] = await Promise.all([
      axios.get(`/api/${barName.toLowerCase()}/sales`),
      axios.get(`/api/${barName.toLowerCase()}/expenses`),
    ])

    salesMap.value[barName] = salesRes.data
    expensesMap.value[barName] = expensesRes.data
  } catch (err) {
    console.error(`Failed to fetch data for ${barName}`, err)
    salesMap.value[barName] = []
    expensesMap.value[barName] = []
  }
}

// Fetch data on mount
onMounted(() => {
  barList.value.forEach(bar => fetchBarData(bar.name))
})

// Compute current revenue and growth
const barsWithRevenue = computed(() =>
  barList.value.map(bar => {
    const sales = salesMap.value[bar.name] || []
    const expenses = expensesMap.value[bar.name] || []

    const totalSales = sales.reduce((sum, s) => sum + Number(s.amount || 0), 0)
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const currentRevenue = totalSales - totalExpenses

    // Previous revenue: let's just use last X days, or previous period (optional)
    const previousRevenue = sales
      .slice(1) // for demo, skipping first sale (replace with actual previous period logic)
      .reduce((sum, s) => sum + Number(s.amount || 0), 0)

    const growthPercentage = previousRevenue
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0

    return {
      name: bar.name,
      currentRevenue,
      growthPercentage,
    }
  })
)
</script>
