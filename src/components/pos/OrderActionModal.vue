<template>
  <div v-if="show" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/60">
    <div class="w-full max-w-sm mx-4 rounded-2xl bg-gray-800 p-6 text-white">
      <h2 class="text-lg font-semibold mb-2">{{ mode === 'void' ? 'Void Order' : 'Refund Order' }}</h2>
      <p class="text-sm text-gray-400 mb-2">{{ order?.order_number }} · ${{ Number(order?.total_amount || 0).toFixed(2) }}</p>
      <p class="text-xs text-amber-400 mb-4">{{ mode === 'void' && order?.status === 'completed' ? 'Manager PIN required' : mode === 'refund' ? 'Manager PIN required' : '' }}</p>
      <textarea v-model="reason" rows="2" placeholder="Reason (optional)" class="w-full px-3 py-2 mb-3 text-sm bg-gray-900 border border-gray-700 rounded-lg" />
      <div v-if="needsManagerPin" class="mb-4">
        <label class="block text-sm text-gray-300 mb-2">Manager PIN</label>
        <PinInput v-model="managerPin" />
      </div>
      <p v-if="error" class="text-sm text-red-400 mb-2">{{ error }}</p>
      <div class="flex gap-3">
        <button @click="$emit('close')" class="flex-1 py-2.5 text-sm bg-gray-700 rounded-lg">Cancel</button>
        <button @click="submit" :disabled="loading" class="flex-1 py-2.5 text-sm font-medium rounded-lg disabled:opacity-50" :class="mode === 'void' ? 'bg-amber-600' : 'bg-red-600'">
          {{ loading ? '...' : mode === 'void' ? 'Void' : 'Refund' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { posApi } from '@/api/venuepos.api'
import PinInput from './PinInput.vue'

const props = defineProps<{
  show: boolean
  branchId: number
  order: Record<string, unknown> | null
  mode: 'void' | 'refund'
}>()

const emit = defineEmits<{ close: []; done: [] }>()

const reason = ref('')
const managerPin = ref('')
const loading = ref(false)
const error = ref('')

const needsManagerPin = computed(() =>
  props.mode === 'refund' || (props.mode === 'void' && props.order?.status === 'completed')
)

watch(() => props.show, () => {
  reason.value = ''
  managerPin.value = ''
  error.value = ''
})

async function submit() {
  if (!props.order) return
  loading.value = true
  error.value = ''
  try {
    if (props.mode === 'void') {
      await posApi.voidOrder(props.branchId, props.order.id as number, {
        reason: reason.value,
        managerPin: managerPin.value || undefined,
      })
    } else {
      await posApi.refundOrder(props.branchId, props.order.id as number, {
        reason: reason.value,
        managerPin: managerPin.value,
      })
    }
    emit('done')
    emit('close')
  } catch (err: unknown) {
    error.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
  } finally {
    loading.value = false
  }
}
</script>
