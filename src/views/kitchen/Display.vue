<template>
  <div class="min-h-screen bg-gray-950 text-white flex flex-col">
    <header class="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
      <div>
        <h1 class="text-xl font-bold">Kitchen Display</h1>
        <p class="text-sm text-gray-400">{{ branchName }} · Auto-refresh {{ countdown }}s</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="px-3 py-1 text-sm rounded-full bg-orange-500/20 text-orange-400">
          {{ pendingCount }} pending
        </span>
        <router-link to="/" class="text-sm text-gray-400 hover:text-white">← Exit</router-link>
      </div>
    </header>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-500">Loading orders...</div>

    <div v-else-if="!orders.length" class="flex-1 flex items-center justify-center">
      <div class="text-center text-gray-500">
        <p class="text-4xl mb-2">✓</p>
        <p>All caught up — no active kitchen orders</p>
      </div>
    </div>

    <div v-else class="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 overflow-y-auto">
      <div
        v-for="order in orders"
        :key="order.id"
        :class="statusColor(order.kitchen_status)"
        class="rounded-2xl border-2 p-4 flex flex-col"
      >
        <div class="flex items-start justify-between mb-3">
          <div>
            <p class="font-bold text-lg">{{ order.order_number }}</p>
            <p class="text-sm opacity-80">
              {{ order.table_number ? `Table ${order.table_number}` : order.tab_name || order.order_type }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold">{{ order.wait_minutes }}m</p>
            <p class="text-xs opacity-60">wait time</p>
          </div>
        </div>

        <ul class="flex-1 space-y-2 mb-4">
          <li
            v-for="item in order.items"
            :key="item.id"
            class="flex items-center justify-between p-2 rounded-lg bg-black/20"
          >
            <span class="font-medium">{{ item.quantity }}× {{ item.product_name }}</span>
            <button
              @click="updateItem(item)"
              :class="itemStatusClass(item.kitchen_status)"
              class="px-2 py-0.5 text-xs rounded capitalize"
            >
              {{ item.kitchen_status }}
            </button>
          </li>
        </ul>

        <div class="flex gap-2">
          <button
            v-if="order.kitchen_status === 'pending'"
            @click="updateOrder(order, 'in_progress')"
            class="flex-1 py-2 text-sm font-medium bg-blue-600 rounded-lg hover:bg-blue-500"
          >
            Start
          </button>
          <button
            v-if="order.kitchen_status === 'in_progress'"
            @click="updateOrder(order, 'ready')"
            class="flex-1 py-2 text-sm font-medium bg-green-600 rounded-lg hover:bg-green-500"
          >
            Ready
          </button>
          <button
            v-if="order.kitchen_status === 'ready'"
            @click="updateOrder(order, 'served')"
            class="flex-1 py-2 text-sm font-medium bg-gray-600 rounded-lg hover:bg-gray-500"
          >
            Served
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { kitchenApi } from '@/api/venuepos.api'

const route = useRoute()
const auth = useAuthStore()
const branchId = computed(() => Number(route.params.branchId))

interface KitchenItem { id: number; quantity: number; product_name: string; kitchen_status: string }
interface KitchenOrder { id: number; order_number: string; kitchen_status: string; table_number?: string; tab_name?: string; order_type: string; wait_minutes: number; items: KitchenItem[] }

const orders = ref<KitchenOrder[]>([])
const loading = ref(true)
const countdown = ref(15)
const branchName = ref('')

const pendingCount = computed(() =>
  orders.value.filter((o) => o.kitchen_status === 'pending' || o.kitchen_status === 'in_progress').length
)

const itemFlow: Record<string, string> = { pending: 'preparing', preparing: 'ready', ready: 'served' }

function statusColor(status: string) {
  if (status === 'pending') return 'border-orange-500 bg-orange-500/10'
  if (status === 'in_progress') return 'border-blue-500 bg-blue-500/10'
  if (status === 'ready') return 'border-green-500 bg-green-500/10'
  return 'border-gray-600'
}

function itemStatusClass(status: string) {
  if (status === 'ready') return 'bg-green-600'
  if (status === 'preparing') return 'bg-blue-600'
  return 'bg-orange-600'
}

async function loadOrders() {
  try {
    const { data } = await kitchenApi.getOrders(branchId.value)
    orders.value = data.orders
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function updateOrder(order: KitchenOrder, status: string) {
  await kitchenApi.updateOrderStatus(branchId.value, order.id, status)
  await loadOrders()
}

async function updateItem(item: KitchenItem) {
  const next = itemFlow[item.kitchen_status]
  if (!next) return
  await kitchenApi.updateItemStatus(branchId.value, item.id, next)
  await loadOrders()
}

let pollTimer: ReturnType<typeof setInterval>
let countdownTimer: ReturnType<typeof setInterval>

onMounted(() => {
  const branch = auth.branches.find((b) => b.id === branchId.value)
  branchName.value = branch?.name || `Branch #${branchId.value}`
  loadOrders()
  pollTimer = setInterval(loadOrders, 15000)
  countdownTimer = setInterval(() => {
    countdown.value = countdown.value <= 1 ? 15 : countdown.value - 1
  }, 1000)
})

onUnmounted(() => {
  clearInterval(pollTimer)
  clearInterval(countdownTimer)
})
</script>
