<template>
  <div
    class="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4
           dark:border-gray-800 dark:bg-white/[0.03] sm:px-6"
  >
    <!-- Header -->
    <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">
        Sales for {{ barSlug }}
      </h3>

      <div class="flex items-center gap-3">
        <button
          @click="openForm = !openForm"
          class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white
                 px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs
                 hover:bg-gray-50 hover:text-gray-800
                 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400
                 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
        >
          Record Sale
        </button>
      </div>
    </div>

    <!-- Record Sale Form -->
    <div v-if="openForm" class="mb-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <!-- Product Dropdown -->
        <div>
          <label class="block text-gray-700 dark:text-gray-300 text-sm mb-1">Product</label>
          <select v-model="saleForm.productId" @change="onProductChange" class="input w-full">
            <option value="">Select product</option>
            <option v-for="p in products" :key="p.product_id" :value="Number(p.product_id)">
              {{ p.product }}
            </option>
          </select>
        </div>

        <!-- Employee Dropdown -->
        <div>
          <label class="block text-gray-700 dark:text-gray-300 text-sm mb-1">Employee</label>
          <select v-model="saleForm.employeeId" class="input w-full">
            <option value="">Select employee</option>
            <option v-for="e in normalizedEmployees" :key="e.id" :value="e.id">
              {{ e.name }}
            </option>
          </select>
        </div>

        <!-- Quantity -->
        <div>
          <label class="block text-gray-700 dark:text-gray-300 text-sm mb-1">Quantity (bottles)</label>
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
          <label class="block text-gray-700 dark:text-gray-300 text-sm mb-1">Amount</label>
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
          class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Save
        </button>
        <button
          @click="resetForm"
          class="bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="max-w-full overflow-x-auto custom-scrollbar">
      <table class="min-w-full">
        <thead>
        <tr class="border-t border-gray-100 dark:border-gray-800">
          <th class="py-3 text-left">Employee</th>
          <th class="py-3 text-left">Product</th>
          <th class="py-3 text-left">Qty (bottles)</th>
          <th class="py-3 text-left">Unit Price</th>
          <th class="py-3 text-left">Amount</th>
          <th class="py-3 text-left">Date</th>
        </tr>
        </thead>

        <tbody>
        <tr
          v-for="s in sales"
          :key="s.sale_time"
          class="border-t border-gray-100 dark:border-gray-800"
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

// ---------------- Types ----------------
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
  units_available: number
  selling_price: number
  buying_price: string
  units_per_case: number
}

type Employee = {
  id: number
  name: string
}

// ---------------- Props ----------------
const props = defineProps<{
  barSlug: string
  sales: Sale[]
  products: Product[]
  employees: Employee[] | { data: Employee[] }
}>()

// ---------------- Emits ----------------
const emit = defineEmits<{
  (e: 'sale-recorded', sale: Sale): void
}>()

// ---------------- Form ----------------
const openForm = ref(false)
const saleForm = reactive({
  productId: null as number | null,
  employeeId: null as number | null,
  quantity: 1,
  unitPrice: 0,
  amount: 0,
})

// ---------------- Helpers ----------------
function formatPrice(value: any) {
  const num = Number(value)
  return isNaN(num) ? '0.00' : num.toFixed(2)
}

// Normalize employees (handle .data if present)
const normalizedEmployees = computed(() => {
  if (Array.isArray(props.employees)) return props.employees
  if (props.employees && 'data' in props.employees) return props.employees.data
  return []
})

// Update unit price when product changes
function onProductChange() {
  const product = props.products.find(p => p.product_id === saleForm.productId)
  saleForm.unitPrice = product ? product.selling_price : 0
  calculateAmount()
}

// Calculate total amount
function calculateAmount() {
  saleForm.amount = saleForm.quantity * saleForm.unitPrice
}

// Reset form
function resetForm() {
  openForm.value = false
  saleForm.productId = null
  saleForm.employeeId = null
  saleForm.quantity = 1
  saleForm.unitPrice = 0
  saleForm.amount = 0
}

// ---------------- Record Sale ----------------
async function recordSale() {
  if (!saleForm.productId || !saleForm.employeeId || saleForm.quantity < 1) {
    alert('Please fill all fields')
    return
  }

  try {
    const res = await fetch(`http://localhost:3000/api/bars/${props.barSlug}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: saleForm.productId,
        employee_id: saleForm.employeeId,
        quantity: saleForm.quantity,
      }),
    })

    if (!res.ok) {
      const errData = await res.json()
      throw new Error(errData.message || `HTTP error ${res.status}`)
    }

    const newSale: Sale = await res.json()

    // Emit event to parent
    emit('sale-recorded', newSale)

    // Deduct stock locally for instant UI update
    const product = props.products.find(p => p.product_id === saleForm.productId)
    if (product) {
      product.units_available -= saleForm.quantity
    }

    // Reset form
    resetForm()

  } catch (err) {
    console.error('Failed to record sale', err)
    alert(`Failed to record sale: ${err.message}`)
  }
}

</script>
