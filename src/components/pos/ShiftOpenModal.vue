<template>
  <div v-if="show" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/60">
    <div class="w-full max-w-md mx-4 rounded-2xl bg-gray-800 p-6 text-white">
      <h2 class="text-lg font-semibold mb-4">Open Shift</h2>
      <p class="text-sm text-gray-400 mb-4">Count the cash in the drawer before starting.</p>
      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm text-gray-300 mb-1">Staff Member *</label>
          <select v-model="form.employeeId" required class="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm">
            <option :value="null" disabled>Select employee</option>
            <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.first_name }} {{ e.last_name }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1">Opening Cash in Drawer</label>
          <input v-model.number="form.openingCash" type="number" step="0.01" min="0" class="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm" />
        </div>
        <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
        <div class="flex gap-3">
          <button type="button" @click="$emit('close')" class="flex-1 py-2.5 text-sm bg-gray-700 rounded-lg">Cancel</button>
          <button type="submit" :disabled="loading" class="flex-1 py-2.5 text-sm font-medium bg-brand-500 rounded-lg disabled:opacity-50">
            {{ loading ? 'Opening...' : 'Open Shift' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { shiftsApi } from '@/api/venuepos.api'

const props = defineProps<{
  show: boolean
  branchId: number
  employees: Array<{ id: number; first_name: string; last_name: string }>
}>()

const emit = defineEmits<{ close: []; opened: [shift: unknown] }>()

const form = ref({ employeeId: null as number | null, openingCash: 0 })
const loading = ref(false)
const error = ref('')

async function submit() {
  if (!form.value.employeeId) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await shiftsApi.open(props.branchId, form.value)
    emit('opened', data.shift)
    emit('close')
  } catch (err: unknown) {
    error.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
  } finally {
    loading.value = false
  }
}
</script>
