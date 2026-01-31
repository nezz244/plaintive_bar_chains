<template>
  <div class="bg-white dark:bg-gray-900 rounded-xl p-6 shadow">
    <h2 class="text-lg font-semibold mb-4">Product Profitability</h2>

    <table class="w-full text-sm">
      <thead>
      <tr class="border-b">
        <th class="text-left py-2">Product</th>
        <th class="text-right py-2">Units Sold</th>
        <th class="text-right py-2">Profit</th>
      </tr>
      </thead>

      <tbody>
      <tr v-for="p in products" :key="p.name" class="border-b">
        <td class="py-2">{{ p.name }}</td>
        <td class="py-2 text-right">{{ p.units_sold }}</td>
        <td class="py-2 text-right font-semibold text-green-600">
          R {{ Number(p.profit).toFixed(2) }}
        </td>
      </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dashboardApi } from '@/api/dashboard.api'

const products = ref<any[]>([])

onMounted(async () => {
  const { data } = await dashboardApi.getProducts()
  products.value = data
})
</script>
