<template>
  <admin-layout>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-800 dark:text-white">Expenses</h1>
        <p class="text-sm text-gray-500 mt-1">Rent, salaries, utilities, and branch costs</p>
      </div>
      <button
        v-if="auth.isOwnerOrAdmin"
        @click="showForm = true"
        class="px-4 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600"
      >
        + Add Expense
      </button>
    </div>

    <div class="flex flex-wrap gap-3 mb-6">
      <select v-model="filterBranch" class="px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
        <option value="">All locations</option>
        <option value="company">Company-wide (HQ)</option>
        <option v-for="b in auth.branches" :key="b.id" :value="String(b.id)">{{ b.name }}</option>
      </select>
      <input v-model="filterFrom" type="date" class="px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
      <input v-model="filterTo" type="date" class="px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
      <button @click="load" class="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg">Filter</button>
    </div>

    <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <th class="px-5 py-3 text-left font-medium text-gray-500">Date</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Category</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Location</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Description</th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">Amount</th>
            <th v-if="auth.isOwnerOrAdmin" class="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in expenses" :key="e.id" class="border-b border-gray-100 dark:border-gray-800/50">
            <td class="px-5 py-4 text-gray-500">{{ e.expense_date }}</td>
            <td class="px-5 py-4 capitalize">{{ e.category }}</td>
            <td class="px-5 py-4 text-gray-500">{{ e.branch_name || 'Company-wide' }}</td>
            <td class="px-5 py-4 text-gray-500">{{ e.description || '—' }}</td>
            <td class="px-5 py-4 text-right font-medium">${{ Number(e.amount).toFixed(2) }}</td>
            <td v-if="auth.isOwnerOrAdmin" class="px-5 py-4 text-right">
              <button @click="remove(e.id)" class="text-xs text-red-500 hover:underline">Delete</button>
            </td>
          </tr>
          <tr v-if="!expenses.length && !loading">
            <td colspan="6" class="px-5 py-8 text-center text-gray-500">No expenses recorded</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/50">
      <div class="w-full max-w-md mx-4 rounded-2xl bg-white p-6 dark:bg-gray-900">
        <h2 class="text-lg font-semibold mb-4 dark:text-white">Add Expense</h2>
        <form @submit.prevent="create" class="space-y-4">
          <div>
            <label class="block text-sm mb-1 dark:text-gray-300">Location</label>
            <select v-model="form.branchId" class="w-full px-3 py-2.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
              <option value="">Company-wide (rent, salaries)</option>
              <option v-for="b in auth.branches" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm mb-1 dark:text-gray-300">Category *</label>
            <select v-model="form.category" required class="w-full px-3 py-2.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm mb-1 dark:text-gray-300">Type</label>
            <select v-model="form.expenseType" class="w-full px-3 py-2.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
              <option value="fixed">Fixed (rent, insurance)</option>
              <option value="payroll">Payroll</option>
              <option value="variable">Variable</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm mb-1 dark:text-gray-300">Amount *</label>
              <input v-model.number="form.amount" type="number" step="0.01" min="0" required class="w-full px-3 py-2.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
            <div>
              <label class="block text-sm mb-1 dark:text-gray-300">Date *</label>
              <input v-model="form.expenseDate" type="date" required class="w-full px-3 py-2.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
          </div>
          <div>
            <label class="block text-sm mb-1 dark:text-gray-300">Description</label>
            <input v-model="form.description" class="w-full px-3 py-2.5 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          </div>
          <p v-if="formError" class="text-sm text-red-500">{{ formError }}</p>
          <div class="flex gap-3">
            <button type="button" @click="showForm = false" class="flex-1 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg">Cancel</button>
            <button type="submit" class="flex-1 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg">Save</button>
          </div>
        </form>
      </div>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { expensesApi } from '@/api/venuepos.api'

const auth = useAuthStore()
const expenses = ref<Array<Record<string, unknown>>>([])
const categories = ref<string[]>([])
const loading = ref(true)
const showForm = ref(false)
const formError = ref('')
const filterBranch = ref('')
const filterFrom = ref('')
const filterTo = ref('')

const form = ref({
  branchId: '' as string | number,
  category: 'rent',
  expenseType: 'fixed',
  amount: 0,
  expenseDate: new Date().toISOString().slice(0, 10),
  description: '',
})

async function load() {
  loading.value = true
  const params: Record<string, string> = {}
  if (filterBranch.value) params.branchId = filterBranch.value
  if (filterFrom.value) params.from = filterFrom.value
  if (filterTo.value) params.to = filterTo.value
  const { data } = await expensesApi.list(params)
  expenses.value = data.expenses
  categories.value = data.categories
  loading.value = false
}

async function create() {
  formError.value = ''
  try {
    await expensesApi.create({
      branchId: form.value.branchId || null,
      category: form.value.category,
      expenseType: form.value.expenseType,
      amount: form.value.amount,
      expenseDate: form.value.expenseDate,
      description: form.value.description,
    })
    showForm.value = false
    await load()
  } catch (err: unknown) {
    formError.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
  }
}

async function remove(id: number) {
  if (!confirm('Delete this expense?')) return
  await expensesApi.remove(id)
  await load()
}

onMounted(load)
</script>
