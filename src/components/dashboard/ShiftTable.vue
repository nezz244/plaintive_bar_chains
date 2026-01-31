<template>
  <div
    class="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4
           dark:border-gray-800 dark:bg-white/[0.03] sm:px-6"
  >
    <!-- Header -->
    <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">
        Shifts & Cash Handover
      </h3>
    </div>

    <!-- Table -->
    <div class="max-w-full overflow-x-auto custom-scrollbar">
      <table class="min-w-full">
        <thead>
        <tr class="border-t border-gray-100 dark:border-gray-800">
          <th class="py-3 text-left">Employee</th>
          <th class="py-3 text-left">Shift</th>
          <th class="py-3 text-left">Opening</th>
          <th class="py-3 text-left">Expected</th>
          <th class="py-3 text-left">Closing</th>
          <th class="py-3 text-left">Variance</th>
          <th class="py-3 text-left">Manager Approval</th>
          <th class="py-3 text-left">Action</th>
        </tr>
        </thead>

        <tbody>
        <tr
          v-for="s in shifts"
          :key="s.id"
          class="border-t border-gray-100 dark:border-gray-800"
        >
          <!-- Employee -->
          <td class="py-3 whitespace-nowrap">
            <p class="font-medium text-gray-800 text-theme-sm dark:text-white/90">
              {{ s.name }}
            </p>
          </td>

          <!-- Shift Time -->
          <td class="py-3 whitespace-nowrap">
            <p class="text-gray-500 text-theme-sm dark:text-gray-400">
              {{ formatShiftTime(s.start_time, s.end_time) }}
            </p>
          </td>

          <!-- Opening -->
          <td class="py-3 whitespace-nowrap">
            <p class="text-gray-500 text-theme-sm dark:text-gray-400">
              {{ formatCurrency(s.opening_cash) }}
            </p>
          </td>

          <!-- Expected -->
          <td class="py-3 whitespace-nowrap">
            <p class="text-gray-500 text-theme-sm dark:text-gray-400">
              {{ formatCurrency(s.expected_cash) }}
            </p>
          </td>

          <!-- Closing -->
          <td class="py-3 whitespace-nowrap">
            <p class="text-gray-500 text-theme-sm dark:text-gray-400">
              {{ s.closing_cash ? formatCurrency(s.closing_cash) : '—' }}
            </p>
          </td>

          <!-- Variance with trend -->
          <td class="py-3 whitespace-nowrap">
              <span
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-theme-xs font-medium"
                :class="varianceClass(s.variance)"
                :title="varianceTrendTooltip(s.variance, s.previous_variance)"
              >
                <span>{{ varianceArrow(s.variance, s.previous_variance) }}</span>
                {{ formatCurrency(s.variance) }}
              </span>
          </td>

          <!-- Manager Approval -->
          <td class="py-3 whitespace-nowrap">
              <span
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-theme-xs font-medium"
                :class="managerApprovalClass(s.approved_by_manager)"
              >
                {{ s.approved_by_manager ? '✅ Approved' : '⏳ Pending' }}
              </span>
          </td>

          <!-- Handover Action -->
          <td class="py-3 whitespace-nowrap">
            <button
              @click="confirmHandover(s)"
              :disabled="s.closing_cash !== null || !s.approved_by_manager"
              class="inline-flex items-center rounded-lg px-3 py-1.5 text-theme-xs font-medium text-white
                       transition-colors
                       disabled:bg-gray-300 disabled:text-gray-600
                       bg-brand-500 hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700"
            >
              Handover
            </button>
          </td>
        </tr>
        </tbody>
      </table>
    </div>

    <!-- Confirmation Modal -->
    <div v-if="handoverShift" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-white dark:bg-gray-900 rounded-2xl p-6 w-96">
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
          Confirm Handover
        </h3>
        <p class="text-gray-600 dark:text-gray-300 mb-6">
          Are you sure you want to handover the shift for <strong>{{ handoverShift.name }}</strong>?
        </p>
        <div class="flex justify-end gap-3">
          <button
            @click="handoverShift = null"
            class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            @click="executeHandover"
            class="px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Shift {
  id: number
  name: string
  opening_cash: number
  expected_cash: number
  closing_cash: number | null
  variance: number
  previous_variance?: number
  start_time: string
  end_time: string
  approved_by_manager: boolean
}

const props = defineProps<{
  shifts: Shift[]
}>()

const emit = defineEmits<{
  (e: 'handover', id: number): void
}>()

// Confirmation modal
const handoverShift = ref<Shift | null>(null)

function confirmHandover(shift: Shift) {
  handoverShift.value = shift
}

function executeHandover() {
  if (handoverShift.value) {
    emit('handover', handoverShift.value.id)
    handoverShift.value = null
  }
}

// Formatting functions
function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value)
}

function formatShiftTime(start: string, end: string) {
  const s = new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const e = new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${s} → ${e}`
}

// Variance color / trend
function varianceClass(variance: number) {
  if (variance === 0) return 'bg-gray-100 text-gray-600 dark:bg-gray-700/30'
  if (variance > 0) return 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500'
  return 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
}

function varianceArrow(variance: number, previous?: number) {
  if (previous == null) return ''
  return variance > previous ? '▲' : variance < previous ? '▼' : '→'
}

function varianceTrendTooltip(variance: number, previous?: number) {
  if (previous == null) return 'No previous data'
  return `Previous: ${formatCurrency(previous)}, Current: ${formatCurrency(variance)}`
}

// Manager approval class
function managerApprovalClass(approved: boolean) {
  return approved
    ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500'
    : 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400'
}
</script>
