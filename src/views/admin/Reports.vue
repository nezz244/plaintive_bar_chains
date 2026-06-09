<template>
  <admin-layout>
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-gray-800 dark:text-white">Reports</h1>
      <p class="text-sm text-gray-500 mt-1">Profit & loss and stock audit monitoring</p>
    </div>

    <div class="flex flex-wrap gap-3 mb-6">
      <select v-model="branchId" class="px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
        <option value="">All branches</option>
        <option v-for="b in auth.branches" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
      <input v-model="from" type="date" class="px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
      <input v-model="to" type="date" class="px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
      <button @click="load" class="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg">Run Report</button>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">Loading...</div>

    <template v-else-if="pl">
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <div v-for="k in kpiCards" :key="k.label" class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <p class="text-xs text-gray-500">{{ k.label }}</p>
          <p class="text-xl font-bold mt-1 dark:text-white" :class="k.color">{{ k.value }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 class="font-semibold mb-4 dark:text-white">Revenue by Branch</h2>
          <table class="w-full text-sm">
            <tr v-for="b in pl.byBranch" :key="b.id" class="border-b border-gray-100 dark:border-gray-800">
              <td class="py-2 dark:text-white">{{ b.name }}</td>
              <td class="py-2 text-right">${{ Number(b.revenue).toFixed(2) }}</td>
              <td class="py-2 text-right text-red-500">-${{ Number(b.branch_expenses).toFixed(2) }}</td>
            </tr>
          </table>
        </div>
        <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 class="font-semibold mb-4 dark:text-white">Expenses by Category</h2>
          <table class="w-full text-sm">
            <tr v-for="c in pl.expensesByCategory" :key="c.category" class="border-b border-gray-100 dark:border-gray-800">
              <td class="py-2 capitalize dark:text-white">{{ c.category }}</td>
              <td class="py-2 text-right text-red-500">${{ Number(c.total).toFixed(2) }}</td>
            </tr>
            <tr v-if="!pl.expensesByCategory.length">
              <td colspan="2" class="py-4 text-gray-500 text-center">No expenses in range</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
        <div class="p-5 border-b border-gray-200 dark:border-gray-800">
          <h2 class="font-semibold dark:text-white">Shift Stock Audits</h2>
          <p class="text-xs text-gray-500 mt-1">Flagged handovers need manager review</p>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-900/50">
              <th class="px-5 py-3 text-left text-gray-500">Branch</th>
              <th class="px-5 py-3 text-left text-gray-500">Staff</th>
              <th class="px-5 py-3 text-left text-gray-500">Closed</th>
              <th class="px-5 py-3 text-right text-gray-500">Stock Var.</th>
              <th class="px-5 py-3 text-right text-gray-500">Cash Var.</th>
              <th class="px-5 py-3 text-left text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in stockAudits" :key="s.id" class="border-t border-gray-100 dark:border-gray-800">
              <td class="px-5 py-3 dark:text-white">{{ s.branch_name }}</td>
              <td class="px-5 py-3">{{ s.employee_name }}</td>
              <td class="px-5 py-3 text-gray-500">{{ formatDate(s.end_time) }}</td>
              <td class="px-5 py-3 text-right" :class="s.stock_variance_total > 0 ? 'text-red-500' : ''">{{ s.stock_variance_total }}</td>
              <td class="px-5 py-3 text-right">${{ Number(s.cash_variance || 0).toFixed(2) }}</td>
              <td class="px-5 py-3">
                <span :class="auditClass(s.stock_audit_status)" class="text-xs font-medium capitalize px-2 py-1 rounded-full">{{ s.stock_audit_status }}</span>
              </td>
            </tr>
            <tr v-if="!stockAudits.length">
              <td colspan="6" class="px-5 py-8 text-center text-gray-500">No closed shifts in range</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </admin-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { reportsApi } from '@/api/venuepos.api'

const auth = useAuthStore()
const loading = ref(true)
const branchId = ref<number | ''>('')
const from = ref(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
const to = ref(new Date().toISOString().slice(0, 10))
const pl = ref<Record<string, unknown> | null>(null)
const stockAudits = ref<Array<Record<string, unknown>>>([])

const kpiCards = computed(() => {
  const s = pl.value?.summary as Record<string, number> | undefined
  if (!s) return []
  return [
    { label: 'Revenue', value: `$${s.revenue.toFixed(2)}`, color: 'text-gray-800 dark:text-white' },
    { label: 'COGS', value: `$${s.cogs.toFixed(2)}`, color: 'text-red-500' },
    { label: 'Gross Profit', value: `$${s.grossProfit.toFixed(2)}`, color: 'text-green-600' },
    { label: 'Expenses', value: `$${s.expenses.toFixed(2)}`, color: 'text-red-500' },
    { label: 'Net Profit', value: `$${s.netProfit.toFixed(2)}`, color: s.netProfit >= 0 ? 'text-green-600' : 'text-red-500' },
    { label: 'Margin', value: `${s.marginPct}%`, color: 'text-brand-500' },
  ]
})

function formatDate(d: string) {
  return d ? new Date(d).toLocaleString() : '—'
}

function auditClass(status: string) {
  if (status === 'flagged') return 'bg-red-100 text-red-700'
  if (status === 'approved') return 'bg-green-100 text-green-700'
  return 'bg-gray-100 text-gray-600'
}

async function load() {
  loading.value = true
  const params: Record<string, string | number> = { from: from.value, to: to.value }
  if (branchId.value) params.branchId = branchId.value
  const [plRes, auditRes] = await Promise.all([
    reportsApi.profitAndLoss(params),
    reportsApi.stockAudit(params),
  ])
  pl.value = plRes.data
  stockAudits.value = auditRes.data.shifts
  loading.value = false
}

onMounted(load)
</script>
