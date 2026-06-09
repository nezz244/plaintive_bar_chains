<template>
  <div class="min-h-screen bg-gray-900 text-white flex flex-col">
    <!-- Shift gate -->
    <div v-if="!context?.shift && !loading" class="flex-1 flex items-center justify-center p-6">
      <div class="text-center max-w-md">
        <p class="text-6xl mb-4">🔐</p>
        <h2 class="text-xl font-bold mb-2">Shift Required</h2>
        <p class="text-gray-400 mb-6">Open a shift with your opening cash count to start processing sales.</p>
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
            <p class="text-xs text-gray-400">Shift open · {{ context.shift?.employee_name }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <select v-model="orderType" class="px-2 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg">
            <option value="bar_tab">Bar Tab</option>
            <option value="dine_in">Dine In</option>
            <option value="takeaway">Takeaway</option>
          </select>
          <select v-if="orderType === 'dine_in'" v-model="selectedTableId" class="px-2 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg">
            <option :value="null">Select table</option>
            <option v-for="t in context.tables" :key="t.id" :value="t.id">Table {{ t.table_number }} ({{ t.status }})</option>
          </select>
          <select v-model="selectedTabId" class="px-2 py-1.5 text-xs bg-gray-900 border border-gray-700 rounded-lg">
            <option :value="null">No tab</option>
            <option v-for="t in context.tabs" :key="t.id" :value="t.id">{{ t.tab_name }}</option>
          </select>
          <button @click="showShiftClose = true" class="px-3 py-1.5 text-xs bg-red-600/80 rounded-lg hover:bg-red-600">Close Shift</button>
        </div>
      </header>

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
                  <p v-if="product.send_to_kitchen" class="text-xs text-orange-400 mt-0.5">🍳 Kitchen</p>
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
            <div class="flex justify-between text-sm text-gray-400">
              <span>Subtotal</span><span>${{ cartTotal.toFixed(2) }}</span>
            </div>
            <div v-if="taxAmount > 0" class="flex justify-between text-sm text-gray-400">
              <span>Tax ({{ context.taxRate }}%)</span><span>${{ taxAmount.toFixed(2) }}</span>
            </div>
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
            <div v-if="paymentMethod === 'cash'" class="flex gap-2">
              <input v-model.number="amountTendered" type="number" step="0.01" placeholder="Amount tendered" class="flex-1 px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-lg" />
              <span v-if="amountTendered >= grandTotal" class="text-green-400 text-sm self-center">
                Change: ${{ (amountTendered - grandTotal).toFixed(2) }}
              </span>
            </div>
            <button @click="checkout" :disabled="!cart.length || processing" class="w-full py-3 text-sm font-semibold bg-brand-500 rounded-xl hover:bg-brand-600 disabled:opacity-50">
              {{ processing ? 'Processing...' : paymentMethod === 'tab' ? 'Send to Tab' : paymentMethod === 'yoco' ? 'Pay with Yoco' : 'Complete Sale' }}
            </button>
            <button v-if="cart.length" @click="cart = []" class="w-full py-2 text-sm text-gray-400">Clear</button>
          </div>
        </div>
      </div>
    </template>

    <ShiftOpenModal :show="showShiftOpen" :branch-id="branchId" :employees="context?.employees || []" @close="showShiftOpen = false" @opened="onShiftOpened" />
    <ShiftCloseModal :show="showShiftClose" :branch-id="branchId" :shift="context?.shift || null" @close="showShiftClose = false" @closed="onShiftClosed" />
    <YocoPaymentModal
      :show="showYoco"
      :amount="grandTotal"
      :public-key="context?.publicKey || ''"
      :currency="context?.currency || 'ZAR'"
      @close="showYoco = false"
      @success="onYocoSuccess"
    />

    <!-- Receipt modal -->
    <div v-if="lastReceipt" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/60">
      <div class="bg-white rounded-2xl p-4 max-w-sm w-full mx-4">
        <ReceiptPrint ref="receiptRef" :receipt="lastReceipt" :currency="currencySymbol" />
        <div class="flex gap-2 mt-4">
          <button @click="printReceipt" class="flex-1 py-2.5 text-sm font-medium bg-brand-500 text-white rounded-lg">Print Receipt</button>
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
import { posApi } from '@/api/venuepos.api'
import ShiftOpenModal from '@/components/pos/ShiftOpenModal.vue'
import ShiftCloseModal from '@/components/pos/ShiftCloseModal.vue'
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
  tabs: Array<{ id: number; tab_name: string }>
  employees: Array<{ id: number; first_name: string; last_name: string }>
  yocoEnabled: boolean
  publicKey: string
  taxRate: number
  currency: string
} | null>(null)

const products = ref<Array<{ id: number; name: string; category: string; selling_price: number; stock: number; send_to_kitchen: boolean }>>([])
const cart = ref<Array<{ productId: number; name: string; price: number; quantity: number }>>([])
const orderType = ref('bar_tab')
const selectedTableId = ref<number | null>(null)
const selectedTabId = ref<number | null>(null)
const paymentMethod = ref('cash')
const amountTendered = ref<number | null>(null)
const showShiftOpen = ref(false)
const showShiftClose = ref(false)
const showYoco = ref(false)
const lastReceipt = ref<{ order: Record<string, unknown>; items: unknown[]; payments: unknown[] } | null>(null)
const receiptRef = ref<InstanceType<typeof ReceiptPrint> | null>(null)
const branchName = ref('')

const currencySymbol = computed(() => {
  const c = context.value?.currency || 'ZAR'
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
      amountTendered: amountTendered.value,
      employeeId: context.value?.shift?.employee_id,
      payLater: paymentMethod.value === 'tab',
    })
    lastReceipt.value = data.receipt
    cart.value = []
    amountTendered.value = null
    await loadContext()
  } catch (err) {
    alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Checkout failed')
  } finally {
    processing.value = false
  }
}

function checkout() {
  if (paymentMethod.value === 'tab' && !selectedTabId.value) {
    alert('Select a tab to charge')
    return
  }
  if (paymentMethod.value === 'yoco') {
    showYoco.value = true
    return
  }
  completeOrder()
}

async function onYocoSuccess(token: string) {
  showYoco.value = false
  await completeOrder(token)
}

function onShiftOpened(shift: unknown) {
  if (context.value) context.value.shift = shift as Record<string, unknown>
}

function onShiftClosed() {
  if (context.value) context.value.shift = null
  showShiftOpen.value = true
}

function printReceipt() {
  receiptRef.value?.print()
}

onMounted(async () => {
  branchName.value = auth.branches.find((b) => b.id === branchId.value)?.name || `Branch #${branchId.value}`
  try {
    await Promise.all([loadContext(), loadProducts()])
  } finally {
    loading.value = false
  }
})
</script>
