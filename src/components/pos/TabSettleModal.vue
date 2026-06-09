<template>
  <div v-if="show" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/60">
    <div class="w-full max-w-lg mx-4 rounded-2xl bg-gray-800 p-6 text-white max-h-[90vh] overflow-y-auto">
      <h2 class="text-lg font-semibold mb-1">Settle Tab</h2>
      <p v-if="tabDetail" class="text-sm text-gray-400 mb-4">{{ tabDetail.tab.tab_name }} · {{ tabDetail.tab.customer_name || 'Guest' }}</p>

      <div v-if="loading" class="text-center py-8 text-gray-400">Loading tab...</div>

      <template v-else-if="tabDetail">
        <div class="space-y-2 mb-4 max-h-48 overflow-y-auto">
          <div v-for="order in tabDetail.orders.filter(o => o.status === 'open')" :key="order.id" class="p-3 bg-gray-900 rounded-lg text-sm">
            <div class="flex justify-between font-medium mb-1">
              <span>{{ order.order_number }}</span>
              <span>${{ Number(order.total_amount).toFixed(2) }}</span>
            </div>
            <p v-for="item in order.items" :key="item.product_name" class="text-xs text-gray-400">
              {{ item.quantity }}× {{ item.product_name }}
            </p>
          </div>
          <p v-if="!tabDetail.orders.filter(o => o.status === 'open').length" class="text-gray-500 text-sm">No open orders on this tab</p>
        </div>

        <div class="flex justify-between text-lg font-bold mb-4">
          <span>Total due</span>
          <span class="text-brand-400">${{ tabDetail.openTotal.toFixed(2) }}</span>
        </div>

        <select v-model="paymentMethod" class="w-full px-3 py-2 mb-3 text-sm bg-gray-900 border border-gray-700 rounded-lg">
          <option value="cash">Cash</option>
          <option value="card">Card (manual)</option>
          <option v-if="yocoEnabled" value="yoco">Card (Yoco)</option>
          <option value="mobile">Mobile Money</option>
        </select>
        <input
          v-if="paymentMethod === 'cash'"
          v-model.number="amountTendered"
          type="number"
          step="0.01"
          placeholder="Amount tendered"
          class="w-full px-3 py-2 mb-3 text-sm bg-gray-900 border border-gray-700 rounded-lg"
        />
        <input
          v-if="paymentMethod === 'mobile'"
          v-model="mobileReference"
          placeholder="Mobile money reference"
          class="w-full px-3 py-2 mb-3 text-sm bg-gray-900 border border-gray-700 rounded-lg"
        />
        <label class="flex items-center gap-2 text-sm mb-4">
          <input v-model="closeTab" type="checkbox" class="rounded" />
          Close tab after payment
        </label>
        <p v-if="error" class="text-sm text-red-400 mb-2">{{ error }}</p>
        <div class="flex gap-3">
          <button @click="$emit('close')" class="flex-1 py-2.5 text-sm bg-gray-700 rounded-lg">Cancel</button>
          <button @click="settle" :disabled="processing || tabDetail.openTotal <= 0" class="flex-1 py-2.5 text-sm font-medium bg-brand-500 rounded-lg disabled:opacity-50">
            {{ processing ? 'Processing...' : 'Settle & Pay' }}
          </button>
        </div>
      </template>
    </div>

    <YocoPaymentModal
      :show="showYoco"
      :amount="tabDetail?.openTotal || 0"
      :public-key="publicKey"
      :currency="currency"
      @close="showYoco = false"
      @success="onYocoSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { tablesApi } from '@/api/venuepos.api'
import YocoPaymentModal from './YocoPaymentModal.vue'

const props = defineProps<{
  show: boolean
  branchId: number
  tabId: number | null
  yocoEnabled: boolean
  publicKey: string
  currency: string
}>()

const emit = defineEmits<{ close: []; settled: [data: unknown] }>()

const loading = ref(false)
const processing = ref(false)
const error = ref('')
const tabDetail = ref<{ tab: Record<string, unknown>; orders: Array<Record<string, unknown> & { items: unknown[] }>; openTotal: number } | null>(null)
const paymentMethod = ref('cash')
const amountTendered = ref<number | null>(null)
const mobileReference = ref('')
const closeTab = ref(true)
const showYoco = ref(false)

watch(() => [props.show, props.tabId], async ([visible, tabId]) => {
  if (visible && tabId) {
    loading.value = true
    error.value = ''
    try {
      const { data } = await tablesApi.getTab(props.branchId, tabId as number)
      tabDetail.value = data
    } catch {
      error.value = 'Failed to load tab'
    } finally {
      loading.value = false
    }
  }
})

function settle() {
  if (paymentMethod.value === 'yoco') {
    showYoco.value = true
    return
  }
  completeSettle()
}

async function onYocoSuccess(token: string) {
  showYoco.value = false
  await completeSettle(token)
}

async function completeSettle(yocoToken?: string) {
  if (!props.tabId) return
  processing.value = true
  error.value = ''
  try {
    const { data } = await tablesApi.settleTab(props.branchId, props.tabId, {
      paymentMethod: paymentMethod.value === 'yoco' ? 'yoco' : paymentMethod.value,
      yocoToken,
      amountTendered: amountTendered.value,
      mobileReference: mobileReference.value,
      closeTab: closeTab.value,
    })
    emit('settled', data)
    emit('close')
  } catch (err: unknown) {
    error.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Settlement failed'
  } finally {
    processing.value = false
  }
}
</script>
