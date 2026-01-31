<template>
  <div class="rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/[0.03]">

    <!-- HEADER -->
    <div class="px-5 pt-5 bg-white shadow-default rounded-2xl pb-6 dark:bg-gray-900 sm:px-6 sm:pt-6">

      <div class="flex justify-between items-start gap-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">
            Warehouse Stock
          </h3>
          <p class="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Total Value: {{ formatCurrency(totalStockValue) }}
          </p>
        </div>

        <!-- ACTION BUTTONS -->
        <div class="flex gap-2">
          <button
            @click="showAddModal = true"
            class="px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            + Add Stock
          </button>

          <button
            @click="showReconModal = true"
            class="px-3 py-2 text-sm rounded-lg bg-yellow-500 text-white hover:bg-yellow-600"
          >
            Reconcile
          </button>

          <button
            @click="showTransferModal = true"
            class="px-3 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          >
            Transfer Bars
          </button>


          <button
            @click="showDistributeModal = true"
            class="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Distribute
          </button>
        </div>
      </div>

      <!-- RADIAL -->
      <div class="relative max-h-[195px] mt-6">
        <VueApexCharts type="radialBar" height="330"
                       :options="chartOptions"
                       :series="[warehouseStockPercentage]" />
      </div>
    </div>

    <!-- STOCK LIST -->
    <div class="px-6 py-5">
      <div
        v-for="item in warehouseStock"
        :key="item.product"
        class="flex justify-between py-1 border-b border-gray-200 dark:border-gray-800"
      >
        <p>{{ item.product }}</p>
        <p class="font-semibold">
          {{ item.cases_available }} cases
          <span class="text-xs text-gray-400">
            ({{ item.cases_available * item.units_per_case }} bottles)
          </span>
        </p>
      </div>
    </div>

    <!-- DISTRIBUTION HISTORY -->
    <div class="px-6 pb-5">
      <h4 class="font-semibold mb-2">Recent Distributions</h4>
      <div
        v-for="log in distributionHistory"
        :key="log.id"
        class="text-sm border-b py-1"
      >
        {{ log.product }} → {{ log.bar }}
        ({{ log.cases }} cases)
        — signed by <b>{{ log.employee }}</b>
        <span class="text-xs text-gray-400">
          {{ formatDate(log.signed_at) }}
        </span>
      </div>
    </div>

    <!-- ADD MODAL -->
    <Modal v-if="showAddModal" title="Add Warehouse Stock" @close="showAddModal=false">
      <select v-model="addForm.product_name">
        <option disabled value="">Select product</option>
        <option v-for="p in products" :key="p.id" :value="p.name">
          {{ p.name }}
        </option>
      </select>

      <input type="number" v-model.number="addForm.cases_to_add" placeholder="Cases" min="1" />

      <button @click="submitAddStock" class="btn-green">Add</button>
    </Modal>
    <!-- DISTRIBUTE MODAL -->
    <Modal v-if="showDistributeModal" title="Distribute Stock" @close="showDistributeModal=false">

      <select v-model="distributeForm.product">
        <option disabled value="">Select product</option>
        <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>


      <input type="number" v-model="distributeForm.cases" placeholder="Cases" />

      <p v-if="exceedsStock" class="text-red-600 text-sm">
        Cannot distribute more than available stock
      </p>

      <select v-model="distributeForm.bar_id">
        <option disabled value="">Select bar</option>
        <option v-for="b in bars" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>


      <select v-model="distributeForm.employee_id">
        <option disabled value="">Employee signing</option>
        <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.name }}</option>
      </select>

      <button
        :disabled="exceedsStock"
        @click="submitDistribute"
        class="btn-blue"
      >
        Distribute & Sign
      </button>

    </Modal>
    <Modal v-if="showReconModal" title="Warehouse Reconciliation" @close="showReconModal=false">

      <select v-model="reconForm.product_id">
        <option disabled value="">Product</option>
        <option v-for="p in products" :key="p.id" :value="p.id">
          {{ p.name }}
        </option>
      </select>

      <input
        type="number"
        v-model="reconForm.physical_cases"
        placeholder="Physical case count"
      />

      <textarea
        v-model="reconForm.notes"
        placeholder="Reconciliation notes"
      />

      <button @click="submitRecon" class="btn-yellow">
        Reconcile & Adjust
      </button>
    </Modal>
    <Modal v-if="showTransferModal" title="Transfer Stock Between Bars" @close="showTransferModal=false">

      <select v-model="transferForm.product_id">
        <option disabled value="">Product</option>
        <option v-for="p in products" :key="p.id" :value="p.id">
          {{ p.name }}
        </option>
      </select>

      <select v-model="transferForm.from_bar_id">
        <option disabled value="">From Bar</option>
        <option v-for="b in bars" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>

      <select v-model="transferForm.to_bar_id">
        <option disabled value="">To Bar</option>
        <option v-for="b in bars" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>

      <input
        type="number"
        v-model="transferForm.cases"
        placeholder="Cases to transfer"
      />

      <select v-model="transferForm.employee_id">
        <option disabled value="">Initiated by</option>
        <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.name }}</option>
      </select>

      <button @click="submitTransfer" class="btn-purple">
        Transfer Stock
      </button>
    </Modal>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import Modal from '@/components/profile/Modal.vue'
import { reactive } from 'vue'



/* =====================================================
   TYPES
===================================================== */

interface StockItem {
  product: string
  cases_available: number
  buying_price: number
  units_per_case?: number
}

interface Product {
  id: number
  name: string
}

interface Bar {
  id: number
  name: string
}

interface Employee {
  id: number
  name: string
}

/* =====================================================
   STATE
===================================================== */

const warehouseStock = ref<StockItem[]>([])
const products = ref<Product[]>([])
const bars = ref<Bar[]>([])
const employees = ref<Employee[]>([])
const distributionHistory = ref<any[]>([])

/* =====================================================
   MODALS
===================================================== */

const showAddModal = ref(false)
const showDistributeModal = ref(false)
const showReconModal = ref(false)
const showTransferModal = ref(false)

/* =====================================================
   FORMS
===================================================== */

const addForm = reactive({
  product_name: '',   // store the name selected by user
  cases_to_add: 0,           // number of cases to add
  employee_id: 0,     // optional
  notes: ''
})


const distributeForm = ref({
  product: '',
  cases: 0,
  bar_id: '',
  employee_id: ''
})

const reconForm = ref({
  product_id: '',
  physical_cases: 0,
  notes: '',
  employee_id: 1
})

const transferForm = ref({
  product_id: '',
  from_bar_id: '',
  to_bar_id: '',
  cases: 0,
  employee_id: 1
})

/* =====================================================
   FETCHERS
===================================================== */

async function fetchWarehouseStock() {
  try {
    const res = await fetch('http://localhost:3000/api/warehouse-stock')
    warehouseStock.value = await res.json()
  } catch (err) {
    console.error('Warehouse fetch failed', err)
  }
}

async function fetchReferenceData() {
  try {
    const [p, b, e] = await Promise.all([
      fetchJson('http://localhost:3000/api/products'),
      fetchJson('http://localhost:3000/api/bars'),
      fetchJson('http://localhost:3000/api/employees')
    ])

    products.value = p
    bars.value = b
    employees.value = e
  } catch (err) {
    console.error('Reference fetch failed', err)
  }
}



/* =====================================================
   COMPUTED
===================================================== */

const totalStockValue = computed(() =>
  warehouseStock.value.reduce(
    (sum, i) => sum + i.cases_available * i.buying_price,
    0
  )
)

const warehouseStockPercentage = computed(() => {
  const total = warehouseStock.value.reduce(
    (sum, i) => sum + i.cases_available,
    0
  )
  const max = warehouseStock.value.length * 200
  return max ? (total / max) * 100 : 0
})

const exceedsStock = computed(() => {
  const item = warehouseStock.value.find(
    i => i.product === distributeForm.value.product
  )
  if (!item) return false
  return distributeForm.value.cases > item.cases_available
})

/* =====================================================
   HELPERS
===================================================== */

const formatCurrency = (value?: number | null): string =>
  value == null
    ? '—'
    : new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'USD'
    }).format(value)

const formatDate = (date: string) =>
  new Date(date).toLocaleString()

/* =====================================================
   SUBMITS
===================================================== */
async function fetchJson(url: string) {
  const res = await fetch(url)

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const text = await res.text()
    throw new Error(
      `${url} returned non-JSON:\n${text.slice(0, 120)}`
    )
  }

  return res.json()
}


async function submitAddStock() {
  try {
    console.log('Form data:', addForm.product_name, addForm.cases_to_add)
    // Map product name to id
    console.log(products.value.find(p => p.name === addForm.product_name));
    const product = products.value.find(p => p.name === addForm.product_name)

    if (!product || addForm.cases_to_add <= 0) {
      alert('Please select a product and enter a valid number of cases.')
      return
    }

    const payload = {
      product_id: product.id,    // send the id to backend
      cases_to_add: addForm.cases_to_add,
      employee_id: addForm.employee_id || undefined,
      notes: addForm.notes || 'Added stock'
    }

    console.log('Submitting payload:', payload)

    const res = await fetch('/api/warehouse/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to add stock')

    console.log('Stock added:', data)

    // Refresh warehouse stock
    await fetchWarehouseStock()

    // Reset form & close modal
    showAddModal.value = false
    addForm.product_name = ''
    addForm.cases_to_add = 0
    addForm.employee_id = 0
    addForm.notes = ''
  } catch (err: any) {
    console.error(err)
    alert(err.message || 'Error adding stock')
  }
}


async function submitDistribute() {
  // Map the form to backend expected fields
  const payload = {
    product_id: distributeForm.value.product, // must be the ID
    bar_id: distributeForm.value.bar_id,
    cases_to_send: distributeForm.value.cases, // number of cases
    employee_id: distributeForm.value.employee_id || null,
    notes: distributeForm.value.notes || null
  }

  console.log('Payload sent to backend:', payload)

  // Basic validation
  if (!payload.product_id || !payload.bar_id || !payload.cases_to_send || payload.cases_to_send <= 0) {
    alert('Please select a product, a bar, and enter a valid number of cases')
    return
  }

  try {
    const res = await fetch('http://localhost:3000/api/warehouse/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to distribute stock')
    }

    alert(`Successfully distributed ${payload.cases_to_send} cases to bar ${payload.bar_id}`)

    showDistributeModal.value = false
    await fetchWarehouseStock()
  } catch (err) {
    console.error('Distribute stock error:', err)
    alert(err.message)
  }
}


async function submitRecon() {
  await fetch('http://localhost:3000/api/warehouse/reconcile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reconForm.value)
  })

  showReconModal.value = false
  await fetchWarehouseStock()
}

async function submitTransfer() {
  await fetch('http://localhost:3000/api/bars/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transferForm.value)
  })

  showTransferModal.value = false
}

/* =====================================================
   CHART
===================================================== */

const chartOptions = {
  colors: ['#465FFF'],
  chart: {
    fontFamily: 'Outfit, sans-serif',
    sparkline: { enabled: true }
  },
  plotOptions: {
    radialBar: {
      startAngle: -90,
      endAngle: 90,
      hollow: { size: '80%' },
      track: {
        background: '#E4E7EC',
        strokeWidth: '100%',
        margin: 5
      },
      dataLabels: {
        name: { show: false },
        value: {
          fontSize: '36px',
          fontWeight: 600,
          offsetY: 60,
          formatter: (v: number) => `${v.toFixed(2)}%`
        }
      }
    }
  },
  stroke: { lineCap: 'round' },
  labels: ['Stock']
}

/* =====================================================
   INIT
===================================================== */

onMounted(async () => {
  await fetchWarehouseStock()
  await fetchReferenceData()
})
</script>


