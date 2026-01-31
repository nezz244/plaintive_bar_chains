<template>
  <div
    class="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4
           dark:border-gray-800 dark:bg-white/[0.03] sm:px-6"
  >
    <!-- Header -->
    <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Sales</h3>

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
            <option v-for="p in products" :key="p.id" :value="Number(p.id)">
              {{ p.product }}
            </option>

          </select>
        </div>

        <!-- Employee Dropdown -->
        <div>
          <label class="block text-gray-700 dark:text-gray-300 text-sm mb-1">Employee</label>
          <select v-model="saleForm.employeeId" class="input w-full">
            <option value="">Select employee</option>
            <option v-for="e in employees.data" :key="e.id" :value="e.id">
              {{ e.name }}
            </option>
          </select>
        </div>

        <!-- Quantity -->
        <div>
          <label class="block text-gray-700 dark:text-gray-300 text-sm mb-1">Quantity</label>
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
          <th class="py-3 text-left">Qty</th>
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
import { ref, reactive } from 'vue'

const props = defineProps<{
  sales: any[]
  products: { product: string; units_available: number; id: number }[]  // your bar_stock + product info
  employees: { id: number; name: string }[]
  barSlug: string
}>()

const openForm = ref(false)
const saleForm = reactive({
  productId: null as number | null,
  employeeId: null as number | null,
  quantity: 1,
  unitPrice: 0,
  amount: 0,
})

// Format decimal safely
function formatPrice(value: any) {
  const num = Number(value)
  return isNaN(num) ? '0.00' : num.toFixed(2)
}

// Update unit price when product changes
function onProductChange() {
  const product = props.products.find(p => p.id === saleForm.productId)
  saleForm.unitPrice = product ? parseFloat(product.total_revenue) / parseInt(product.total_sold) : 0
  calculateAmount()

  // Log product info
  console.log('Selected productId:', saleForm.productId)
  console.log('Selected product object:', product)
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

// Record sale
async function recordSale() {
  console.log('ProductID', saleForm.productId)

  if (!saleForm.productId || !saleForm.employeeId || saleForm.quantity < 1) {
    console.warn('Sale form incomplete:', saleForm)
    alert('Please fill all fields')
    return
  }

  try {
    console.log(`Sending POST request for bar ${props.selectedBarId}`)
    const res = await fetch(`http://localhost:3000/api/bars/${props.barSlug}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: saleForm.productId,
        employee_id: saleForm.employeeId,
        quantity: saleForm.quantity,
      }),
    })


    console.log('Response received:', res)

    if (!res.ok) {
      console.error('HTTP error:', res.status, await res.text())
      throw new Error(`HTTP error ${res.status}`)
    }

    const newSale = await res.json()
    console.log('New sale recorded:', newSale)

    // Update table
    props.sales.push(newSale)
    console.log('Sales table updated, total sales now:', props.sales.length)

    // Reset form
    resetForm()
    console.log('Sale form reset')
  } catch (err) {
    console.error('Failed to record sale', err)
    alert('Failed to record sale')
  }
}

</script>
