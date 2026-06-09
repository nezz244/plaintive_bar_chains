<template>
  <div v-if="show" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/60">
    <div class="w-full max-w-md mx-4 rounded-2xl bg-gray-800 p-6 text-white">
      <h2 class="text-lg font-semibold mb-2">Open Shift</h2>
      <p class="text-sm text-gray-400 mb-4">Enter your PIN and count the opening cash.</p>
      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm text-gray-300 mb-2">Employee PIN *</label>
          <PinInput v-model="pinCode" />
          <p v-if="identified" class="text-sm text-green-400 mt-2">
            {{ identified.firstName }} {{ identified.lastName }} ({{ identified.role }})
          </p>
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1">Opening Cash in Drawer</label>
          <input v-model.number="openingCash" type="number" step="0.01" min="0" class="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm" />
        </div>
        <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
        <div class="flex gap-3">
          <button type="button" @click="$emit('close')" class="flex-1 py-2.5 text-sm bg-gray-700 rounded-lg">Cancel</button>
          <button type="submit" :disabled="loading || pinCode.length < 4" class="flex-1 py-2.5 text-sm font-medium bg-brand-500 rounded-lg disabled:opacity-50">
            {{ loading ? 'Opening...' : 'Open Shift' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { shiftsApi, posApi } from '@/api/venuepos.api'
import PinInput from './PinInput.vue'

const props = defineProps<{
  show: boolean
  branchId: number
}>()

const emit = defineEmits<{ close: []; opened: [shift: unknown] }>()

const pinCode = ref('')
const openingCash = ref(0)
const loading = ref(false)
const error = ref('')
const identified = ref<{ id: number; firstName: string; lastName: string; role: string } | null>(null)

watch(pinCode, async (pin) => {
  identified.value = null
  if (pin.length >= 4) {
    try {
      const { data } = await posApi.verifyPin(props.branchId, pin)
      identified.value = data.employee
    } catch {
      identified.value = null
    }
  }
})

watch(() => props.show, (v) => {
  if (v) {
    pinCode.value = ''
    openingCash.value = 0
    error.value = ''
    identified.value = null
  }
})

async function submit() {
  if (!identified.value) {
    error.value = 'Enter a valid employee PIN'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const { data } = await shiftsApi.open(props.branchId, {
      employeeId: identified.value.id,
      openingCash: openingCash.value,
      pinCode: pinCode.value,
    })
    emit('opened', data.shift)
    emit('close')
  } catch (err: unknown) {
    error.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
  } finally {
    loading.value = false
  }
}
</script>
