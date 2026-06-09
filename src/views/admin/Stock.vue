<template>
  <admin-layout>
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-gray-800 dark:text-white">Stock & Warehouse</h1>
      <p class="text-sm text-gray-500 mt-1">
        Mode: <span class="font-medium capitalize">{{ warehouseMode?.replace('_', ' ') }}</span>
        — configure in Settings
      </p>
    </div>

    <select v-model="selectedBranchId" class="mb-6 px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
      <option v-for="b in auth.branches" :key="b.id" :value="b.id">{{ b.name }}</option>
    </select>

    <div v-if="loading" class="text-center py-12 text-gray-500">Loading...</div>

    <template v-else>
      <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden mb-8">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-gray-50 dark:bg-gray-900/50">
              <th class="px-5 py-3 text-left text-gray-500">Product</th>
              <th class="px-5 py-3 text-right text-gray-500">Warehouse (cases)</th>
              <th class="px-5 py-3 text-right text-gray-500">Floor stock</th>
              <th v-if="auth.isOwnerOrAdmin" class="px-5 py-3 text-right text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in products" :key="p.id" class="border-b border-gray-100 dark:border-gray-800/50">
              <td class="px-5 py-4">
                <p class="font-medium dark:text-white">{{ p.name }}</p>
                <p class="text-xs text-gray-400">{{ p.category }}</p>
              </td>
              <td class="px-5 py-4 text-right">{{ p.warehouse_cases }}</td>
              <td class="px-5 py-4 text-right font-medium">{{ p.floor_stock }}</td>
              <td v-if="auth.isOwnerOrAdmin" class="px-5 py-4 text-right">
                <button @click="openTransfer(p)" class="text-xs text-brand-500 hover:underline mr-3">Release</button>
                <button @click="openWastage(p)" class="text-xs text-red-500 hover:underline">Wastage</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 class="font-semibold mb-4 dark:text-white">Stock vs Sales (30 days)</h2>
        <table class="w-full text-sm">
          <tr v-for="r in reconciliation?.salesVsStock || []" :key="r.product_id" class="border-b border-gray-100 dark:border-gray-800">
            <td class="py-2 dark:text-white">{{ r.product_name }}</td>
            <td class="py-2 text-right">{{ r.units_sold }} sold</td>
            <td class="py-2 text-right text-gray-500">{{ r.current_floor_stock }} on floor</td>
          </tr>
        </table>
      </div>
    </template>

    <div v-if="modal" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/50">
      <div class="w-full max-w-sm mx-4 rounded-2xl bg-white p-6 dark:bg-gray-900">
        <h2 class="text-lg font-semibold mb-4 dark:text-white">{{ modal === 'transfer' ? 'Release to Floor' : 'Record Wastage' }}</h2>
        <p class="text-sm text-gray-500 mb-4">{{ activeProduct?.name }}</p>
        <input v-model.number="modalQty" type="number" min="1" class="w-full px-3 py-2.5 mb-4 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
        <input v-model="modalNotes" placeholder="Notes (optional)" class="w-full px-3 py-2.5 mb-4 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
        <p v-if="modalError" class="text-sm text-red-500 mb-2">{{ modalError }}</p>
        <div class="flex gap-3">
          <button @click="modal = null" class="flex-1 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg">Cancel</button>
          <button @click="submitModal" class="flex-1 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg">Confirm</button>
        </div>
      </div>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { stockApi } from '@/api/venuepos.api'

const auth = useAuthStore()
const selectedBranchId = ref(auth.branches[0]?.id || null)
const products = ref<Array<Record<string, unknown>>>([])
const warehouseMode = ref('central')
const reconciliation = ref<Record<string, unknown> | null>(null)
const loading = ref(true)
const modal = ref<'transfer' | 'wastage' | null>(null)
const activeProduct = ref<Record<string, unknown> | null>(null)
const modalQty = ref(1)
const modalNotes = ref('')
const modalError = ref('')

async function load() {
  if (!selectedBranchId.value) return
  loading.value = true
  const [stockRes, reconRes] = await Promise.all([
    stockApi.get(selectedBranchId.value),
    stockApi.reconciliation(selectedBranchId.value),
  ])
  products.value = stockRes.data.products
  warehouseMode.value = stockRes.data.warehouseMode
  reconciliation.value = reconRes.data
  loading.value = false
}

function openTransfer(p: Record<string, unknown>) {
  activeProduct.value = p
  modal.value = 'transfer'
  modalQty.value = 1
  modalNotes.value = ''
  modalError.value = ''
}

function openWastage(p: Record<string, unknown>) {
  activeProduct.value = p
  modal.value = 'wastage'
  modalQty.value = 1
  modalNotes.value = ''
  modalError.value = ''
}

async function submitModal() {
  if (!selectedBranchId.value || !activeProduct.value) return
  modalError.value = ''
  try {
    if (modal.value === 'transfer') {
      await stockApi.transfer(selectedBranchId.value, {
        productId: activeProduct.value.id,
        quantity: modalQty.value,
        notes: modalNotes.value,
      })
    } else {
      await stockApi.adjust(selectedBranchId.value, {
        productId: activeProduct.value.id,
        quantity: -modalQty.value,
        movementType: 'wastage',
        notes: modalNotes.value,
      })
    }
    modal.value = null
    await load()
  } catch (err: unknown) {
    modalError.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
  }
}

watch(selectedBranchId, load)
onMounted(load)
</script>
