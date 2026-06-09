<template>
  <div v-if="show" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/60">
    <div class="w-full max-w-lg mx-4 rounded-2xl bg-gray-800 p-6 text-white max-h-[90vh] overflow-y-auto">
      <h2 class="text-lg font-semibold mb-1">Close Shift</h2>
      <p class="text-xs text-gray-400 mb-4">Step {{ step }} of 2 — {{ step === 1 ? 'Cash count' : 'Stock audit' }}</p>

      <div v-if="step === 1" class="space-y-4">
        <div class="text-sm text-gray-400 space-y-1">
          <p>Opening cash: ${{ Number(shift?.opening_cash || 0).toFixed(2) }}</p>
          <p>Cash sales: ${{ Number(shift?.cash_sales || 0).toFixed(2) }}</p>
          <p class="text-white font-medium">Expected in drawer: ${{ expectedCash.toFixed(2) }}</p>
          <p>Total sales: ${{ Number(shift?.total_sales || 0).toFixed(2) }}</p>
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1">Actual Cash Count *</label>
          <input v-model.number="closingCash" type="number" step="0.01" min="0" required class="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm" />
        </div>
        <div v-if="closingCash != null" :class="cashVariance >= 0 ? 'text-green-400' : 'text-red-400'" class="text-sm">
          Cash variance: ${{ cashVariance.toFixed(2) }}
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1">Notes</label>
          <textarea v-model="notes" rows="2" class="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm" />
        </div>
      </div>

      <div v-else class="space-y-3">
        <p class="text-sm text-gray-400">Count remaining stock for each product. Expected = opening − sold this shift.</p>
        <div v-if="loadingAudit" class="text-center py-6 text-gray-400">Loading products...</div>
        <div v-else-if="!auditLines.length" class="text-sm text-gray-400 py-4">No products require shift audit.</div>
        <div v-for="line in auditLines" :key="line.product_id" class="grid grid-cols-4 gap-2 items-center text-sm border-b border-gray-700 pb-2">
          <span class="col-span-2 truncate">{{ line.product_name }}</span>
          <span class="text-gray-400 text-xs text-right">Exp: {{ line.expected_qty }}</span>
          <input
            v-model.number="counts[line.product_id]"
            type="number"
            min="0"
            :placeholder="String(line.expected_qty)"
            class="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-right"
          />
        </div>
        <div v-if="auditLines.length">
          <label class="block text-sm text-gray-300 mb-1">Stock audit notes</label>
          <textarea v-model="stockAuditNotes" rows="2" class="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm" />
        </div>
      </div>

      <p v-if="error" class="text-sm text-red-400 mt-3">{{ error }}</p>

      <div class="flex gap-3 mt-6">
        <button type="button" @click="step === 1 ? $emit('close') : (step = 1)" class="flex-1 py-2.5 text-sm bg-gray-700 rounded-lg">
          {{ step === 1 ? 'Cancel' : 'Back' }}
        </button>
        <button v-if="step === 1" @click="goToStockStep" :disabled="closingCash == null" class="flex-1 py-2.5 text-sm font-medium bg-brand-500 rounded-lg disabled:opacity-50">
          Next: Stock Count
        </button>
        <button v-else @click="submit" :disabled="loading" class="flex-1 py-2.5 text-sm font-medium bg-red-600 rounded-lg disabled:opacity-50">
          {{ loading ? 'Closing...' : 'Complete Handover' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { shiftsApi } from '@/api/venuepos.api'

const props = defineProps<{
  show: boolean
  branchId: number
  shift: Record<string, unknown> | null
}>()

const emit = defineEmits<{ close: []; closed: [payload?: Record<string, unknown>] }>()

const step = ref(1)
const closingCash = ref<number | null>(null)
const notes = ref('')
const stockAuditNotes = ref('')
const loading = ref(false)
const loadingAudit = ref(false)
const error = ref('')
const auditLines = ref<Array<Record<string, unknown>>>([])
const counts = ref<Record<number, number>>({})

const expectedCash = computed(() =>
  Number(props.shift?.opening_cash || 0) + Number(props.shift?.cash_sales || 0)
)

const cashVariance = computed(() =>
  closingCash.value != null ? closingCash.value - expectedCash.value : 0
)

watch(() => props.show, (visible) => {
  if (visible) {
    step.value = 1
    closingCash.value = null
    notes.value = ''
    stockAuditNotes.value = ''
    error.value = ''
    auditLines.value = []
    counts.value = {}
  }
})

async function goToStockStep() {
  if (closingCash.value == null || !props.shift) return
  error.value = ''
  loadingAudit.value = true
  try {
    const { data } = await shiftsApi.getStockAudit(props.branchId, props.shift.id as number)
    auditLines.value = data.lines
    for (const line of data.lines) {
      counts.value[line.product_id as number] = line.expected_qty as number
    }
    step.value = 2
  } catch (err: unknown) {
    error.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load stock audit'
  } finally {
    loadingAudit.value = false
  }
}

async function submit() {
  if (!props.shift || closingCash.value == null) return
  loading.value = true
  error.value = ''
  try {
    const stockCounts = auditLines.value.map((line) => ({
      productId: line.product_id,
      countedQty: counts.value[line.product_id as number] ?? 0,
    }))
    const { data } = await shiftsApi.close(props.branchId, props.shift.id as number, {
      closingCash: closingCash.value,
      notes: notes.value,
      stockCounts,
      stockAuditNotes: stockAuditNotes.value,
    })
    emit('closed', data)
    emit('close')
  } catch (err: unknown) {
    error.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
  } finally {
    loading.value = false
  }
}
</script>
