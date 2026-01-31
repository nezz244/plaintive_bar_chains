<template>
  <div
    class="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4
           dark:border-gray-800 dark:bg-white/[0.03] sm:px-6"
  >
    <!-- Header + Add Expense -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div class="flex flex-col sm:flex-row sm:items-center gap-4">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Expenses</h3>

        <!-- Filters -->
        <div class="flex items-center gap-2">
          <select v-model="selectedMonth" class="input-select">
            <option value="all">All Months</option>
            <option v-for="(m, i) in months" :key="i" :value="i+1">{{ m }}</option>
          </select>

          <select v-model="selectedYear" class="input-select">
            <option value="all">All Years</option>
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>

        <!-- Expense total + trend -->
        <div class="ml-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <p class="text-gray-700 dark:text-gray-300 font-medium text-theme-sm">
            Total: <strong>{{ formatCurrency(totalExpenses) }}</strong>
          </p>
          <p
            class="text-theme-xs flex items-center gap-1"
            :class="totalGrowth >= 0 ? 'text-success-600 dark:text-success-500' : 'text-error-600 dark:text-error-500'"
          >
            <span>{{ totalGrowth >= 0 ? '▲' : '▼' }}</span>
            {{ Math.abs(totalGrowth) }}%
          </p>
        </div>
      </div>

      <button
        @click="open = true"
        class="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-theme-sm font-medium
               text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700 transition-colors"
      >
        Add Expense
      </button>
    </div>

    <!-- Expense Modal -->
    <ExpenseModal
      v-if="open"
      @close="open = false"
      @save="handleAddExpense"
    />

    <!-- Table -->
    <div class="max-w-full overflow-x-auto custom-scrollbar mt-2">
      <table class="min-w-full">
        <thead>
        <tr class="border-t border-gray-100 dark:border-gray-800">
          <th class="py-3 text-left">
            <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Category</p>
          </th>
          <th class="py-3 text-left">
            <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Amount</p>
          </th>
          <th class="py-3 text-left">
            <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Date</p>
          </th>
          <th class="py-3 text-left">
            <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">Trend</p>
          </th>
        </tr>
        </thead>

        <tbody>
        <tr
          v-for="expense in filteredExpenses"
          :key="expense.id"
          class="border-t border-gray-100 dark:border-gray-800"
        >
          <!-- Category badge -->
          <td class="py-3 whitespace-nowrap">
              <span
                :class="categoryClass(expense.category)"
                class="px-2 py-0.5 rounded-full text-theme-xs font-medium"
              >
                {{ expense.category }}
              </span>
          </td>

          <!-- Amount -->
          <td class="py-3 whitespace-nowrap">
            <p class="text-gray-500 text-theme-sm dark:text-gray-400">
              {{ formatCurrency(expense.amount) }}
            </p>
          </td>

          <!-- Date -->
          <td class="py-3 whitespace-nowrap">
            <p class="text-gray-500 text-theme-sm dark:text-gray-400">
              {{ formatDate(expense.expense_date) }}
            </p>
          </td>

          <!-- Trend vs previous month -->
          <td class="py-3 whitespace-nowrap">
              <span
                class="flex items-center gap-1 text-theme-xs font-medium"
                :class="getTrendClass(expense)"
                :title="trendTooltip(expense)"
              >
                {{ getTrendArrow(expense) }}
              </span>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ExpenseModal from './ExpenseModal.vue'

/* --- Types --- */
interface Expense {
  id: number
  category: 'Food' | 'Drinks' | 'Utilities' | 'Other'
  amount: number
  expense_date: string
}

/* --- Props & Emits --- */
const props = defineProps<{ expenses: Expense[] }>()
const emit = defineEmits<{ (e: 'add', expense: Expense): void }>()

/* --- State --- */
const open = ref(false)
const selectedMonth = ref<'all' | number>('all')
const selectedYear = ref<'all' | number>('all')

/* --- Filter dropdown options --- */
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

/* --- Helpers --- */
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value)

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })

const categoryClass = (category: Expense['category']) => {
  const map: Record<Expense['category'], string> = {
    Food: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-500',
    Drinks: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-500',
    Utilities: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-500',
    Other: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300'
  }
  return map[category] ?? map['Other']
}

/* --- Computed --- */
const filteredExpenses = computed(() =>
  props.expenses
    .filter(e => {
      const d = new Date(e.expense_date)
      const monthMatch = selectedMonth.value === 'all' || d.getMonth() + 1 === Number(selectedMonth.value)
      const yearMatch = selectedYear.value === 'all' || d.getFullYear() === Number(selectedYear.value)
      return monthMatch && yearMatch
    })
    .sort((a,b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
)

const totalExpenses = computed(() =>
  filteredExpenses.value.reduce((sum, e) => sum + e.amount, 0)
)

const totalPreviousMonth = computed(() => {
  if (selectedMonth.value === 'all') return 0
  const prevMonth = Number(selectedMonth.value) - 1 || 12
  const year = prevMonth === 12 ? Number(selectedYear.value) - 1 : Number(selectedYear.value)
  return props.expenses
    .filter(e => {
      const d = new Date(e.expense_date)
      return d.getMonth() + 1 === prevMonth && d.getFullYear() === year
    })
    .reduce((sum, e) => sum + e.amount, 0)
})

const totalGrowth = computed(() => {
  const prev = totalPreviousMonth.value
  if (prev === 0) return 0
  return Math.round(((totalExpenses.value - prev) / prev) * 100)
})

/* --- Trend helpers --- */
function getTrendArrow(expense: Expense) {
  const prev = props.expenses.find(e => {
    const d = new Date(e.expense_date)
    const expDate = new Date(expense.expense_date)
    return (
      e.category === expense.category &&
      d.getMonth() === expDate.getMonth() - 1 &&
      d.getFullYear() === expDate.getFullYear()
    )
  })
  if (!prev) return '→'
  return expense.amount > prev.amount ? '▲' : expense.amount < prev.amount ? '▼' : '→'
}

function getTrendClass(expense: Expense) {
  const arrow = getTrendArrow(expense)
  return arrow === '▲'
    ? 'text-success-600 dark:text-success-500'
    : arrow === '▼'
      ? 'text-error-600 dark:text-error-500'
      : 'text-gray-500 dark:text-gray-400'
}

function trendTooltip(expense: Expense) {
  const prev = props.expenses.find(e => {
    const d = new Date(e.expense_date)
    const expDate = new Date(expense.expense_date)
    return (
      e.category === expense.category &&
      d.getMonth() === expDate.getMonth() - 1 &&
      d.getFullYear() === expDate.getFullYear()
    )
  })
  if (!prev) return 'No previous month data'
  return `Previous: ${formatCurrency(prev.amount)}, Current: ${formatCurrency(expense.amount)}`
}

/* --- Modal handler --- */
function handleAddExpense(expense: Expense) {
  emit('add', expense)
  open.value = false
}
</script>
