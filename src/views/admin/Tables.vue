<template>
  <admin-layout>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-800 dark:text-white">Floor Plan</h1>
        <p class="text-sm text-gray-500 mt-1">Manage tables and open tabs</p>
      </div>
      <div class="flex gap-2">
        <select v-model="selectedBranchId" class="px-3 py-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
          <option v-for="b in auth.branches" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
        <button @click="showAddTable = true" class="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg">+ Add Table</button>
      </div>
    </div>

    <div v-if="selectedBranchId" class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <!-- Table grid -->
      <div class="xl:col-span-2 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5">
        <h2 class="font-semibold text-gray-800 dark:text-white mb-4">Tables</h2>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          <div
            v-for="table in tables"
            :key="table.id"
            :class="tableStatusClass(table.status)"
            class="aspect-square rounded-xl border-2 flex flex-col items-center justify-center p-2 cursor-pointer hover:scale-105 transition"
            @click="selectedTable = table"
          >
            <span class="font-bold text-lg">{{ table.table_number }}</span>
            <span class="text-xs capitalize opacity-80">{{ table.status }}</span>
            <span class="text-xs opacity-60">{{ table.capacity }} seats</span>
          </div>
          <div v-if="!tables.length" class="col-span-full py-8 text-center text-gray-500">No tables configured</div>
        </div>
      </div>

      <!-- Open tabs -->
      <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-gray-800 dark:text-white">Open Tabs</h2>
          <button @click="showOpenTab = true" class="text-sm text-brand-500">+ New Tab</button>
        </div>
        <div class="space-y-2">
          <div v-for="tab in tabs" :key="tab.id" class="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
            <div>
              <p class="font-medium text-gray-800 dark:text-white">{{ tab.tab_name }}</p>
              <p class="text-xs text-gray-500">{{ tab.customer_name || 'Walk-in' }}</p>
            </div>
            <div class="text-right">
              <p class="font-bold text-brand-500">${{ Number(tab.total_amount).toFixed(2) }}</p>
              <button @click="closeTab(tab.id)" class="text-xs text-red-500">Close</button>
            </div>
          </div>
          <p v-if="!tabs.length" class="text-sm text-gray-500 text-center py-4">No open tabs</p>
        </div>
      </div>
    </div>

    <!-- Add table modal -->
    <div v-if="showAddTable" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/50">
      <div class="w-full max-w-sm mx-4 rounded-2xl bg-white p-6 dark:bg-gray-900">
        <h2 class="text-lg font-semibold mb-4 dark:text-white">Add Table</h2>
        <form @submit.prevent="addTable" class="space-y-3">
          <input v-model="tableForm.tableNumber" required placeholder="Table number" class="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          <input v-model="tableForm.label" placeholder="Label (optional)" class="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          <input v-model.number="tableForm.capacity" type="number" min="1" placeholder="Capacity" class="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          <select v-model="tableForm.zone" class="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
            <option value="main">Main</option>
            <option value="patio">Patio</option>
            <option value="bar">Bar</option>
            <option value="vip">VIP</option>
          </select>
          <div class="flex gap-2 pt-2">
            <button type="button" @click="showAddTable = false" class="flex-1 py-2 bg-gray-100 rounded-lg dark:bg-gray-800 dark:text-white">Cancel</button>
            <button type="submit" class="flex-1 py-2 bg-brand-500 text-white rounded-lg">Add</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Open tab modal -->
    <div v-if="showOpenTab" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/50">
      <div class="w-full max-w-sm mx-4 rounded-2xl bg-white p-6 dark:bg-gray-900">
        <h2 class="text-lg font-semibold mb-4 dark:text-white">Open Tab</h2>
        <form @submit.prevent="openTab" class="space-y-3">
          <input v-model="tabForm.tabName" required placeholder="Tab name" class="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          <input v-model="tabForm.customerName" placeholder="Customer name" class="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          <select v-model="tabForm.tableId" class="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
            <option :value="null">No table</option>
            <option v-for="t in tables.filter(t => t.status === 'available')" :key="t.id" :value="t.id">Table {{ t.table_number }}</option>
          </select>
          <div class="flex gap-2 pt-2">
            <button type="button" @click="showOpenTab = false" class="flex-1 py-2 bg-gray-100 rounded-lg dark:bg-gray-800 dark:text-white">Cancel</button>
            <button type="submit" class="flex-1 py-2 bg-brand-500 text-white rounded-lg">Open Tab</button>
          </div>
        </form>
      </div>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { tablesApi } from '@/api/venuepos.api'

const auth = useAuthStore()
const selectedBranchId = ref(auth.branches[0]?.id || null)
const tables = ref<Array<{ id: number; table_number: string; label?: string; capacity: number; zone: string; status: string }>>([])
const tabs = ref<Array<{ id: number; tab_name: string; customer_name?: string; total_amount: number }>>([])
const showAddTable = ref(false)
const showOpenTab = ref(false)
const selectedTable = ref<unknown>(null)

const tableForm = ref({ tableNumber: '', label: '', capacity: 4, zone: 'main' })
const tabForm = ref({ tabName: '', customerName: '', tableId: null as number | null })

function tableStatusClass(status: string) {
  const map: Record<string, string> = {
    available: 'border-green-400 bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    occupied: 'border-red-400 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    reserved: 'border-yellow-400 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
    dirty: 'border-gray-400 bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  }
  return map[status] || map.available
}

async function load() {
  if (!selectedBranchId.value) return
  const [tRes, tabRes] = await Promise.all([
    tablesApi.list(selectedBranchId.value),
    tablesApi.listTabs(selectedBranchId.value),
  ])
  tables.value = tRes.data.tables
  tabs.value = tabRes.data.tabs
}

async function addTable() {
  await tablesApi.create(selectedBranchId.value!, tableForm.value)
  showAddTable.value = false
  tableForm.value = { tableNumber: '', label: '', capacity: 4, zone: 'main' }
  await load()
}

async function openTab() {
  await tablesApi.openTab(selectedBranchId.value!, tabForm.value)
  showOpenTab.value = false
  tabForm.value = { tabName: '', customerName: '', tableId: null }
  await load()
}

async function closeTab(tabId: number) {
  await tablesApi.closeTab(selectedBranchId.value!, tabId)
  await load()
}

watch(selectedBranchId, load)
onMounted(load)
</script>
