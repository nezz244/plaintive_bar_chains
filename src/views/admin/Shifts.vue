<template>
  <admin-layout>
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-gray-800 dark:text-white">Shift History</h1>
      <p class="text-sm text-gray-500 mt-1">Cash drawer reconciliation across branches</p>
    </div>

    <select v-model="selectedBranchId" class="mb-6 px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
      <option v-for="b in auth.branches" :key="b.id" :value="b.id">{{ b.name }}</option>
    </select>

    <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <th class="px-5 py-3 text-left font-medium text-gray-500">Staff</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Opened</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Closed</th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">Cash Sales</th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">Card Sales</th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">Total</th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">Variance</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="shift in shifts" :key="shift.id" class="border-b border-gray-100 dark:border-gray-800/50">
            <td class="px-5 py-4 font-medium text-gray-800 dark:text-white">{{ shift.employee_name }}</td>
            <td class="px-5 py-4 text-gray-500">{{ formatDate(shift.start_time) }}</td>
            <td class="px-5 py-4 text-gray-500">{{ shift.end_time ? formatDate(shift.end_time) : '—' }}</td>
            <td class="px-5 py-4 text-right">${{ Number(shift.cash_sales).toFixed(2) }}</td>
            <td class="px-5 py-4 text-right">${{ Number(shift.card_sales).toFixed(2) }}</td>
            <td class="px-5 py-4 text-right font-medium">${{ Number(shift.total_sales).toFixed(2) }}</td>
            <td class="px-5 py-4 text-right" :class="Number(shift.variance) < 0 ? 'text-red-500' : 'text-green-600'">
              {{ shift.variance != null ? `$${Number(shift.variance).toFixed(2)}` : '—' }}
            </td>
            <td class="px-5 py-4 capitalize">
              <span :class="shift.status === 'open' ? 'text-green-600' : 'text-gray-500'" class="text-xs font-medium">{{ shift.status }}</span>
            </td>
          </tr>
          <tr v-if="!shifts.length">
            <td colspan="8" class="px-5 py-8 text-center text-gray-500">No shifts recorded yet</td>
          </tr>
        </tbody>
      </table>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { shiftsApi } from '@/api/venuepos.api'

const auth = useAuthStore()
const selectedBranchId = ref(auth.branches[0]?.id || null)
const shifts = ref<Array<Record<string, unknown>>>([])

function formatDate(d: string) {
  return new Date(d).toLocaleString()
}

async function load() {
  if (!selectedBranchId.value) return
  const { data } = await shiftsApi.list(selectedBranchId.value)
  shifts.value = data.shifts
}

watch(selectedBranchId, load)
onMounted(load)
</script>
