<template>
  <div
    class="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4
           dark:border-gray-800 dark:bg-white/[0.03] sm:px-6"
  >
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">
        Sales for {{ barSlug }}
      </h3>

      <button
        @click="openForm = !openForm"
        class="inline-flex items-center rounded-lg border px-4 py-2 text-sm
               bg-white dark:bg-gray-800 hover:bg-gray-50"
      >
        Record Sale
      </button>
    </div>

    <!-- Record Sale Form -->
    <div v-if="openForm" class="mb-4 rounded-lg border p-4 bg-gray-50 dark:bg-gray-900">
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">

        <!-- Product -->
        <div>
          <label class="text-sm">Product</label>
          <select v-model.number="saleForm.productId" @change="onProductChange" class="input w-full">
            <option value="">Select product</option>
            <option
              v-for="p in products"
              :key="p.product_id"
              :value="p.product_id"
            >
              {{ p.product }} ({{ p.bottles_available }} bottles)
            </option>
          </select>
        </div>

        <!-- Employee -->
        <div>
          <label class="text-sm">Employee</label>
          <select v-model.number="saleForm.employeeId" class="input w-full">
            <option value="">Select employee</option>
            <option
              v-for="e in normalizedEmployees"
              :key="e.id"
              :value="e.id"
            >
              {{ e.name }}
            </option>
          </select>
        </div>

        <!-- Quantity -->
        <div>
          <label class="text-sm">Quantity (bottles)</label>
          <input
            type="number"
            min="1"
            v-model.number="saleForm.quantity"
            @input="calculateAmount"
            class="input w-full"
          />
        </div>

        <!-- Amount -->
        <div>
          <label class="text-sm">Amount</label>
          <input
            type="text"
            :value="formatPrice(saleForm.amount)"
            readonly
            class="input w-full bg-gray-100 dark:bg-gray-800"
          />
        </div>

      </div>

      <div class="mt-4 flex gap-2">
        <button
          @click="recordSale"
          class="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Save
        </button>
        <button
          @click="resetForm"
          class="bg-gray-300 px-4 py-2 rounded"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Sales Table -->
    <div class="overflow-x-auto">
      <table class="min-w-full">
        <thead>
        <tr class="border-t">
          <th class="py-3 text-left">Employee</th>
          <th class="py-3 text-left">Product</th>
          <th class="py-3 text-left">Qty</th>
          <th class="py-3 text-left">Unit</th>
          <th class="py-3 text-left">Amount</th>
          <th class="py-3 text-left">Date</th>
        </tr>
        </thead>
        <tbody>
        <tr
          v-for="s in sales"
          :key="s.sale_time"
          class="border-t"
        >
          <td>{{ s.employee }}</td>
          <td>{{ s.product }}</td>
          <td>{{ s.quantity }}</td>
          <td>{{ formatPrice(s.unit_price) }}</td>
          <td>{{ formatPrice(s.total_price) }}</td>
          <td>{{ new Date(s.sale_time).toLocaleString() }}</td>
        </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'

// ---------- Types ----------
type Sale = {
  employee: string
  product: string
  quantity: number
  unit_price: number
  total_price: number
  sale_time: string
}

type Product = {
  product_id: number
  product: string
  bottles_available: number
  selling_price: number
  buying_price: string
  units_per_case: number
}

type Employee = {
  id: number
  name: string
}

// ---------- Props ----------
const props = defineProps<{
  barSlug: string
  sales: Sale[]
  products: Product[]
  employees: Employee[] | { data: Employee[] }
}>()

// ---------- Emits ----------
const emit = defineEmits<{
  (e: 'sale-recorded', sale: Sale): void
}>()

// ---------- State ----------
const openForm = ref(false)

const saleForm = reactive({
  productId: null as number | null,
  employeeId: null as number | null,
  quantity: 1,
  unitPrice: 0,
  amount: 0,
})

// ---------- Helpers ----------
function formatPrice(val: number) {
  return Number(val).toFixed(2)
}

const normalizedEmployees = computed(() => {
  return Array.isArray(props.employees)
    ? props.employees
    : props.employees?.data ?? []
})

// ---------- Logic ----------
function onProductChange() {
  const product = props.products.find(p => p.product_id === saleForm.productId)
  saleForm.unitPrice = product ? product.selling_price : 0
  calculateAmount()
}

function calculateAmount() {
  saleForm.amount = saleForm.quantity * saleForm.unitPrice
}

function resetForm() {
  openForm.value = false
  saleForm.productId = null
  saleForm.employeeId = null
  saleForm.quantity = 1
  saleForm.unitPrice = 0
  saleForm.amount = 0
}

async function recordSale() {
  if (!saleForm.productId || !saleForm.employeeId || saleForm.quantity < 1) {
    alert('Please fill all fields')
    return
  }

  const res = await fetch(
    `http://localhost:3000/api/bars/${props.barSlug}/sales`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: saleForm.productId,
        employee_id: saleForm.employeeId,
        quantity: saleForm.quantity,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    alert(err.error)
    return
  }

  const newSale: Sale = await res.json()
  emit('sale-recorded', newSale)
  resetForm()
}
</script>
