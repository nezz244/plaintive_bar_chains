<template>
  <div v-if="show" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/60">
    <div class="w-full max-w-md mx-4 rounded-2xl bg-gray-800 p-6 text-white">
      <h2 class="text-lg font-semibold mb-2">Close Shift</h2>
      <div class="text-sm text-gray-400 space-y-1 mb-4">
        <p>Opening cash: ${{ Number(shift?.opening_cash || 0).toFixed(2) }}</p>
        <p>Cash sales: ${{ Number(shift?.cash_sales || 0).toFixed(2) }}</p>
        <p>Card sales: ${{ Number(shift?.card_sales || 0).toFixed(2) }}</p>
        <p class="text-white font-medium">Expected in drawer: ${{ expectedCash.toFixed(2) }}</p>
        <p>Total sales: ${{ Number(shift?.total_sales || 0).toFixed(2) }}</p>
      </div>
      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm text-gray-300 mb-1">Actual Cash Count *</label>
          <input v-model.number="closingCash" type="number" step="0.01" min="0" required class="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm" />
        </div>
        <div v-if="closingCash != null" :class="variance >= 0 ? 'text-green-400' : 'text-red-400'" class="text-sm">
          Variance: ${{ variance.toFixed(2) }}
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1">Notes</label>
          <textarea v-model="notes" rows="2" class="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm" />
        </div>
        <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
        <div class="flex gap-3">
          <button type="button" @click="$emit('close')" class="flex-1 py-2.5 text-sm bg-gray-700 rounded-lg">Cancel</button>
          <button type="submit" :disabled="loading" class="flex-1 py-2.5 text-sm font-medium bg-red-600 rounded-lg disabled:opacity-50">
            {{ loading ? 'Closing...' : 'Close Shift' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { shiftsApi } from '@/api/venuepos.api'

const props = defineProps<{
  show: boolean
  branchId: number
  shift: Record<string, unknown> | null
}>()

const emit = defineEmits<{ close: []; closed: [] }>()

const closingCash = ref<number | null>(null)
const notes = ref('')
const loading = ref(false)
const error = ref('')

const expectedCash = computed(() =>
  Number(props.shift?.opening_cash || 0) + Number(props.shift?.cash_sales || 0)
)

const variance = computed(() =>
  closingCash.value != null ? closingCash.value - expectedCash.value : 0
)

async function submit() {
  if (!props.shift || closingCash.value == null) return
  loading.value = true
  error.value = ''
  try {
    await shiftsApi.close(props.branchId, props.shift.id as number, {
      closingCash: closingCash.value,
      notes: notes.value,
    })
    emit('closed')
    emit('close')
  } catch (err: unknown) {
    error.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
  } finally {
    loading.value = false
  }
}
</script>
