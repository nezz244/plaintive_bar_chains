<template>
  <div v-if="show" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/60">
    <div class="w-full max-w-sm mx-4 rounded-2xl bg-gray-800 p-6 text-white">
      <h2 class="text-lg font-semibold mb-2">Switch Staff</h2>
      <p class="text-sm text-gray-400 mb-4">Enter the new bartender/cashier PIN.</p>
      <PinInput v-model="pinCode" />
      <p v-if="identified" class="text-sm text-green-400 mt-2">{{ identified.firstName }} {{ identified.lastName }}</p>
      <p v-if="error" class="text-sm text-red-400 mt-2">{{ error }}</p>
      <div class="flex gap-3 mt-4">
        <button @click="$emit('close')" class="flex-1 py-2.5 text-sm bg-gray-700 rounded-lg">Cancel</button>
        <button @click="submit" :disabled="!identified || loading" class="flex-1 py-2.5 text-sm font-medium bg-brand-500 rounded-lg disabled:opacity-50">
          Switch
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { shiftsApi, posApi } from '@/api/venuepos.api'
import PinInput from './PinInput.vue'

const props = defineProps<{ show: boolean; branchId: number }>()
const emit = defineEmits<{ close: []; switched: [shift: unknown] }>()

const pinCode = ref('')
const loading = ref(false)
const error = ref('')
const identified = ref<{ id: number; firstName: string; lastName: string } | null>(null)

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

watch(() => props.show, () => { pinCode.value = ''; error.value = ''; identified.value = null })

async function submit() {
  if (!identified.value) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await shiftsApi.switchEmployee(props.branchId, {
      employeeId: identified.value.id,
      pinCode: pinCode.value,
    })
    emit('switched', data.shift)
    emit('close')
  } catch (err: unknown) {
    error.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
  } finally {
    loading.value = false
  }
}
</script>
