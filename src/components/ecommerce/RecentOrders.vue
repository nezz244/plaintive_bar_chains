<template>
  <div
    class="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6"
  >
    <div class="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Yearly Bar Profit</h3>
      </div>

      <div class="flex items-center gap-3">
        <select
          v-model="selectedYear"
          class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-200"
        >
          <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
        </select>
      </div>
    </div>

    <div class="max-w-full overflow-x-auto custom-scrollbar">
      <table class="min-w-full">
        <thead>
        <tr class="border-t border-gray-100 dark:border-gray-800">
          <th class="py-3 text-left">
            <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Rank</p>
          </th>
          <th class="py-3 text-left">
            <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Bar</p>
          </th>
          <th class="py-3 text-left">
            <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Revenue ($)</p>
          </th>
        </tr>
        </thead>
        <tbody>
        <tr
          v-for="(bar, index) in rankedBars"
          :key="bar.name"
          class="border-t border-gray-100 dark:border-gray-800"
        >
          <td class="py-3 whitespace-nowrap">
            <p class="text-gray-800 dark:text-white/90">{{ index + 1 }}</p>
          </td>
          <td class="py-3 whitespace-nowrap">
            <p class="font-medium text-gray-800 dark:text-white/90">{{ bar.name }}</p>
          </td>
          <td class="py-3 whitespace-nowrap">
            <p class="text-gray-500 dark:text-gray-400">${{ bar.revenue.toLocaleString() }}</p>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

// Define types
interface Sale {
  amount: number
  sale_time: string
}

interface Expense {
  amount: number
  expense_date: string
}

interface BarRevenue {
  name: string
  revenue: number
}

const bars = ['dumms', 'marleys', '4jays', 'bulawayo']
const selectedYear = ref(new Date().getFullYear())
const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

const barData = ref<BarRevenue[]>([])

async function fetchBarRevenue(year: number) {
  const results: BarRevenue[] = []

  for (const bar of bars) {
    const { data: sales } = await axios.get<Sale[]>(`/api/${bar}/sales`)
    const { data: expenses } = await axios.get<Expense[]>(`/api/${bar}/expenses`)

    const salesThisYear = sales.filter(
      s => new Date(s.sale_time).getFullYear() === year
    )
    const expensesThisYear = expenses.filter(
      e => new Date(e.expense_date).getFullYear() === year
    )

    // Make sure amounts are numbers
    const totalRevenue = salesThisYear.reduce((sum, s) => sum + Number(s.amount), 0)
    const totalExpenses = expensesThisYear.reduce((sum, e) => sum + Number(e.amount), 0)

    results.push({
      name: bar.charAt(0).toUpperCase() + bar.slice(1),
      revenue: totalRevenue - totalExpenses,
    })
  }

  // Sort descending by revenue
  barData.value = results.sort((a, b) => b.revenue - a.revenue)
}


const rankedBars = computed(() => barData.value)

onMounted(() => fetchBarRevenue(selectedYear.value))
watch(selectedYear, year => fetchBarRevenue(year))
</script>
