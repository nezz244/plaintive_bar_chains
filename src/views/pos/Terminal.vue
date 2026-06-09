<template>
  <div class="min-h-screen bg-gray-900 text-white flex flex-col">
    <div v-if="!context?.shift && !loading" class="flex-1 flex items-center justify-center p-6">
      <div class="text-center max-w-md">
        <p class="text-6xl mb-4">🔐</p>
        <h2 class="text-xl font-bold mb-2">Shift Required</h2>
        <p class="text-gray-400 mb-6">Enter your employee PIN and opening cash to start.</p>
        <button @click="showShiftOpen = true" class="px-6 py-3 bg-brand-500 rounded-xl font-medium hover:bg-brand-600">
          Open Shift
        </button>
      </div>
    </div>

    <template v-else-if="context">
      <header class="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 flex-wrap gap-2">
        <div class="flex items-center gap-4">
          <router-link to="/" class="text-gray-400 hover:text-white text-sm">← Back</router-link>
          <div>
            <h1 class="font-semibold">{{ branchName }}</h1>
            <button @click="showSwitch = true" class="text-xs text-brand-400 hover:underline">
              {{ context.shift?.employee_name }} · Switch staff
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button @click="showOrders = !showOrders" class="px-3 py-1.5 text-xs bg-gray-700 rounded-lg">Orders</button>
          <button @click="showTabPanel = !showTabPanel" class="px-3 py-1.5 text-xs bg-gray-700 rounded-lg">Tabs</button>
          <select v-model="orderType" class="px-2 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg">
            <option value="bar_tab">Bar Tab</option>
            <option value="dine_in">Dine In</option>
            <option value="takeaway">Takeaway</option>
          </select>
          <select v-if="orderType === 'dine_in'" v-model="selectedTableId" class="px-2 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg">
            <option :value="null">Select table</option>
            <option v-for="t in context.tables" :key="t.id" :value="t.id">Table {{ t.table_number }}</option>
          </select>
          <select v-model="selectedTabId" class="px-2 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg">
            <option :value="null">No tab</option>
            <option v-for="t in context.tabs" :key="t.id" :value="t.id">{{ t.tab_name }} (${{ Number(t.total_amount).toFixed(0) }})</option>
          </select>
          <button @click="showShiftClose = true" class="px-3 py-1.5 text-xs bg-red-600/80 rounded-lg">Close Shift</button>
        </div>
      </header>

      <!-- Tabs side panel -->
      <div v-if="showTabPanel" class="bg-gray-850 border-b border-gray-700 px-4 py-3">
        <div class="flex gap-2 overflow-x-auto">
          <button
            v-for="t in context.tabs"
            :key="t.id"
            @click="openSettle(t.id)"
            class="flex-shrink-0 px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 text-sm hover:border-brand-500"
          >
            <span class="font-medium">{{ t.tab_name }}</span>
            <span class="text-brand-400 ml-2">${{ Number(t.total_amount).toFixed(2) }}</span>
          </button>
          <button @click="openNewTab" class="flex-shrink-0 px-4 py-2 rounded-lg border border-dashed border-gray-600 text-sm text-gray-400">+ New Tab</button>
        </div>
      </div>

      <!-- Orders side panel -->
      <div v-if="showOrders" class="bg-gray-800 border-b border-gray-700 max-h-48 overflow-y-auto">
        <table class="w-full text-xs">
          <thead><tr class="text-gray-500 border-b border-gray-700">
            <th class="px-3 py-2 text-left">Order</th><th class="px-3 py-2">Status</th><th class="px-3 py-2 text-right">Total</th><th class="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            <tr v-for="o in todayOrders" :key="o.id" class="border-b border-gray-700/50">
              <td class="px-3 py-2">{{ o.order_number }}</td>
              <td class="px-3 py-2 capitalize">{{ o.status }}</td>
              <td class="px-3 py-2 text-right">${{ Number(o.total_amount).toFixed(2) }}</td>
              <td class="px-3 py-2 text-right space-x-2">
                <button v-if="o.status === 'open' || o.status === 'completed'" @click="openAction(o, 'void')" class="text-amber-400">Void</button>
                <button v-if="o.status === 'completed' && o.payment_status === 'paid'" @click="openAction(o, 'refund')" class="text-red-400">Refund</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-1 overflow-hidden">
        <div class="flex-1 p-4 overflow-y-auto">
          <div v-if="loading" class="text-center py-12 text-gray-500">Loading...</div>
          <div v-else-if="!products.length" class="text-center py-12 text-gray-400">
            <p>No products yet.</p>
            <router-link to="/admin/products" class="text-brand-400 text-sm">Add products →</router-link>
          </div>
          <template v-else>
            <div v-for="(items, category) in groupedProducts" :key="category" class="mb-6">
              <h2 class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">{{ category }}</h2>
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                <button
                  v-for="product in items"
                  :key="product.id"
                  @click="addToCart(product)"
                  :disabled="product.stock <= 0"
                  class="p-4 rounded-xl bg-gray-800 border border-gray-700 hover:border-brand-500 text-left transition disabled:opacity-40"
                >
                  <p class="font-medium text-sm truncate">{{ product.name }}</p>
                  <p class="text-brand-400 font-bold mt-1">${{ Number(product.selling_price).toFixed(2) }}</p>
                </button>
              </div>
            </div>
          </template>
        </div>

        <div class="w-80 lg:w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div class="p-4 border-b border-gray-700 font-semibold">Current Order</div>
          <div class="flex-1 overflow-y-auto p-4 space-y-2">
            <div v-if="!cart.length" class="text-center py-8 text-gray-500 text-sm">Tap products to add</div>
            <div v-for="(item, idx) in cart" :key="idx" class="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ item.name }}</p>
                <p class="text-xs text-gray-400">${{ item.price.toFixed(2) }}</p>
              </div>
              <div class="flex items-center gap-2">
                <button @click="updateQty(idx, -1)" class="w-7 h-7 rounded bg-gray-700 text-sm">−</button>
                <span class="w-6 text-center text-sm">{{ item.quantity }}</span>
                <button @click="updateQty(idx, 1)" class="w-7 h-7 rounded bg-gray-700 text-sm">+</button>
              </div>
            </div>
          </div>
          <div class="p-4 border-t border-gray-700 space-y-3">
            <div class="flex justify-between text-lg font-bold">
              <span>Total</span><span class="text-brand-400">${{ grandTotal.toFixed(2) }}</span>
            </div>
            <select v-model="paymentMethod" class="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-lg">
              <option value="cash">Cash</option>
              <option value="card">Card (manual)</option>
              <option v-if="context.yocoEnabled" value="yoco">Card (Yoco)</option>
              <option value="mobile">Mobile Money</option>
              <option value="tab">Add to Tab</option>
            </select>
            <button @click="checkout" :disabled="!cart.length || processing" class="w-full py-3 text-sm font-semibold bg-brand-500 rounded-xl disabled:opacity-50">
              {{ processing ? 'Processing...' : paymentMethod === 'tab' ? 'Send to Tab' : 'Complete Sale' }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <ShiftOpenModal :show="showShiftOpen" :branch-id="branchId" @close="showShiftOpen = false" @opened="onShiftOpened" />
    <ShiftCloseModal :show="showShiftClose" :branch-id="branchId" :shift="context?.shift || null" @close="showShiftClose = false" @closed="onShiftClosed" />
    <EmployeeSwitchModal :show="showSwitch" :branch-id="branchId" @close="showSwitch = false" @switched="onEmployeeSwitched" />
    <TabSettleModal
      :show="showSettle"
      :branch-id="branchId"
      :tab-id="settleTabId"
      :yoco-enabled="context?.yocoEnabled || false"
      :public-key="context?.publicKey || ''"
      :currency="context?.currency || 'USD'"
      @close="showSettle = false"
      @settled="onTabSettled"
    />
    <OrderActionModal
      :show="!!actionOrder"
      :branch-id="branchId"
      :order="actionOrder"
      :mode="actionMode"
      @close="actionOrder = null"
      @done="refreshOrders"
    />
    <YocoPaymentModal :show="showYoco" :amount="grandTotal" :public-key="context?.publicKey || ''" :currency="context?.currency || 'ZAR'" @close="showYoco = false" @success="onYocoSuccess" />

    <div v-if="lastReceipt" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/60">
      <div class="bg-white rounded-2xl p-4 max-w-sm w-full mx-4">
        <ReceiptPrint ref="receiptRef" :receipt="lastReceipt" :currency="currencySymbol" />
        <div class="flex gap-2 mt-4">
          <button @click="printReceipt" class="flex-1 py-2.5 text-sm font-medium bg-brand-500 text-white rounded-lg">Print</button>
          <button @click="lastReceipt = null" class="flex-1 py-2.5 text-sm bg-gray-100 rounded-lg">Done</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { posApi, tablesApi } from '@/api/venuepos.api'
import ShiftOpenModal from '@/components/pos/ShiftOpenModal.vue'
import ShiftCloseModal from '@/components/pos/ShiftCloseModal.vue'
import EmployeeSwitchModal from '@/components/pos/EmployeeSwitchModal.vue'
import TabSettleModal from '@/components/pos/TabSettleModal.vue'
import OrderActionModal from '@/components/pos/OrderActionModal.vue'
import YocoPaymentModal from '@/components/pos/YocoPaymentModal.vue'
import ReceiptPrint from '@/components/pos/ReceiptPrint.vue'

const route = useRoute()
const auth = useAuthStore()
const branchId = computed(() => Number(route.params.branchId))

const loading = ref(true)
const processing = ref(false)
const context = ref<{
  shift: Record<string, unknown> | null
  tables: Array<{ id: number; table_number: string; status: string }>
  tabs: Array<{ id: number; tab_name: string; total_amount: number }>
  yocoEnabled: boolean
  publicKey: string
  taxRate: number
  currency: string
} | null>(null)

const products = ref<Array<{ id: number; name: string; category: string; selling_price: number; stock: number }>>([])
const cart = ref<Array<{ productId: number; name: string; price: number; quantity: number }>>([])
const todayOrders = ref<Array<Record<string, unknown>>>([])
const orderType = ref('bar_tab')
const selectedTableId = ref<number | null>(null)
const selectedTabId = ref<number | null>(null)
const paymentMethod = ref('cash')
const showShiftOpen = ref(false)
const showShiftClose = ref(false)
const showSwitch = ref(false)
const showTabPanel = ref(false)
const showOrders = ref(false)
const showSettle = ref(false)
const settleTabId = ref<number | null>(null)
const showYoco = ref(false)
const actionOrder = ref<Record<string, unknown> | null>(null)
const actionMode = ref<'void' | 'refund'>('void')
const lastReceipt = ref<{ order: Record<string, unknown>; items: unknown[]; payments: unknown[] } | null>(null)
const receiptRef = ref<InstanceType<typeof ReceiptPrint> | null>(null)
const branchName = ref('')

const currencySymbol = computed(() => {
  const c = context.value?.currency || 'USD'
  if (c === 'ZAR') return 'R'
  if (c === 'USD') return '$'
  return `${c} `
})

const groupedProducts = computed(() => {
  const groups: Record<string, typeof products.value> = {}
  for (const p of products.value) {
    const cat = p.category || 'General'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(p)
  }
  return groups
})

const cartTotal = computed(() => cart.value.reduce((s, i) => s + i.price * i.quantity, 0))
const taxAmount = computed(() => cartTotal.value * ((context.value?.taxRate || 0) / 100))
const grandTotal = computed(() => cartTotal.value + taxAmount.value)

function addToCart(product: { id: number; name: string; selling_price: number }) {
  const existing = cart.value.find((c) => c.productId === product.id)
  if (existing) existing.quantity++
  else cart.value.push({ productId: product.id, name: product.name, price: Number(product.selling_price), quantity: 1 })
}

function updateQty(idx: number, delta: number) {
  cart.value[idx].quantity += delta
  if (cart.value[idx].quantity <= 0) cart.value.splice(idx, 1)
}

async function loadContext() {
  const { data } = await posApi.getContext(branchId.value)
  context.value = data
  if (!data.shift) showShiftOpen.value = true
}

async function loadProducts() {
  const { data } = await posApi.getProducts(branchId.value)
  products.value = data.products
}

async function refreshOrders() {
  const { data } = await posApi.getTodayOrders(branchId.value)
  todayOrders.value = data.orders
  await loadContext()
  await loadProducts()
}

async function completeOrder(yocoToken?: string) {
  processing.value = true
  try {
    const { data } = await posApi.createOrder(branchId.value, {
      items: cart.value.map((c) => ({ productId: c.productId, quantity: c.quantity })),
      orderType: orderType.value,
      tableId: selectedTableId.value,
      tabId: selectedTabId.value,
      paymentMethod: paymentMethod.value === 'yoco' ? 'yoco' : paymentMethod.value,
      yocoToken,
      payLater: paymentMethod.value === 'tab',
    })
    if (paymentMethod.value !== 'tab') lastReceipt.value = data.receipt
    cart.value = []
    await refreshOrders()
  } catch (err) {
    alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Checkout failed')
  } finally {
    processing.value = false
  }
}

function checkout() {
  if (paymentMethod.value === 'tab' && !selectedTabId.value) {
    alert('Select a tab first')
    return
  }
  if (paymentMethod.value === 'yoco') {
    showYoco.value = true
    return
  }
  completeOrder()
}

function openSettle(tabId: number) {
  settleTabId.value = tabId
  showSettle.value = true
}

async function openNewTab() {
  const name = prompt('Tab name (e.g. Table 5, John)')
  if (!name) return
  const { data } = await tablesApi.openTab(branchId.value, { tabName: name })
  selectedTabId.value = data.tab.id
  await loadContext()
}

function openAction(order: Record<string, unknown>, mode: 'void' | 'refund') {
  actionOrder.value = order
  actionMode.value = mode
}

async function onYocoSuccess(token: string) {
  showYoco.value = false
  await completeOrder(token)
}

function onShiftOpened(shift: unknown) {
  if (context.value) context.value.shift = shift as Record<string, unknown>
}

function onEmployeeSwitched(shift: unknown) {
  if (context.value) context.value.shift = shift as Record<string, unknown>
}

function onShiftClosed() {
  if (context.value) context.value.shift = null
  showShiftOpen.value = true
}

async function onTabSettled(data: { receipt?: typeof lastReceipt.value }) {
  if (data.receipt) lastReceipt.value = data.receipt
  await refreshOrders()
}

function printReceipt() {
  receiptRef.value?.print()
}

onMounted(async () => {
  branchName.value = auth.branches.find((b) => b.id === branchId.value)?.name || `Branch #${branchId.value}`
  try {
    await Promise.all([loadContext(), loadProducts(), refreshOrders()])
  } finally {
    loading.value = false
  }
})
</script>
