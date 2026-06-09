<template>
  <admin-layout>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-800 dark:text-white">Product Catalog</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage menu items and inventory across branches</p>
      </div>
      <button
        @click="showCreate = true"
        class="px-4 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600"
      >
        + Add Product
      </button>
    </div>

    <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <th class="px-5 py-3 text-left font-medium text-gray-500">Product</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Category</th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">Cost</th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">Price</th>
            <th class="px-5 py-3 text-right font-medium text-gray-500">Stock</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id" class="border-b border-gray-100 dark:border-gray-800/50">
            <td class="px-5 py-4">
              <p class="font-medium text-gray-800 dark:text-white">{{ product.name }}</p>
              <p v-if="product.sku" class="text-xs text-gray-400">{{ product.sku }}</p>
            </td>
            <td class="px-5 py-4 text-gray-500">{{ product.category || 'General' }}</td>
            <td class="px-5 py-4 text-right text-gray-500">${{ Number(product.buying_price).toFixed(2) }}</td>
            <td class="px-5 py-4 text-right font-medium text-gray-800 dark:text-white">${{ Number(product.selling_price).toFixed(2) }}</td>
            <td class="px-5 py-4 text-right text-gray-500">{{ product.stock ?? '—' }}</td>
          </tr>
          <tr v-if="!products.length && !loading">
            <td colspan="5" class="px-5 py-8 text-center text-gray-500">No products yet. Add your first menu item.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showCreate" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/50">
      <div class="w-full max-w-lg mx-4 rounded-2xl bg-white p-6 dark:bg-gray-900">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Add Product</h2>
        <form @submit.prevent="createProduct" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input v-model="form.name" required class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <input v-model="form.category" placeholder="e.g. Beer, Cocktails" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU</label>
              <input v-model="form.sku" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost Price</label>
              <input v-model.number="form.buyingPrice" type="number" step="0.01" min="0" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Selling Price *</label>
              <input v-model.number="form.sellingPrice" type="number" step="0.01" min="0" required class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
          </div>
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input v-model="form.sendToKitchen" type="checkbox" class="rounded" />
            Send to kitchen (restaurant items)
          </label>
          <p v-if="formError" class="text-sm text-red-500">{{ formError }}</p>
          <div class="flex gap-3">
            <button type="button" @click="showCreate = false" class="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" :disabled="saving" class="flex-1 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg disabled:opacity-50">Add Product</button>
          </div>
        </form>
      </div>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import { posApi } from '@/api/venuepos.api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const products = ref<Array<{ id: number; name: string; sku?: string; category?: string; buying_price: number; selling_price: number; stock?: number }>>([])
const loading = ref(true)
const showCreate = ref(false)
const saving = ref(false)
const formError = ref('')

const form = ref({ name: '', sku: '', category: '', buyingPrice: 0, sellingPrice: 0, sendToKitchen: false })

async function loadProducts() {
  const branchId = auth.branches[0]?.id
  if (!branchId) {
    loading.value = false
    return
  }
  const { data } = await posApi.getProducts(branchId)
  products.value = data.products
  loading.value = false
}

async function createProduct() {
  saving.value = true
  formError.value = ''
  try {
    await posApi.createProduct(form.value)
    showCreate.value = false
    form.value = { name: '', sku: '', category: '', buyingPrice: 0, sellingPrice: 0, sendToKitchen: false }
    await loadProducts()
  } catch (err: unknown) {
    formError.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
  } finally {
    saving.value = false
  }
}

onMounted(loadProducts)
</script>
