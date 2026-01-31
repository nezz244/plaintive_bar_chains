<template>
  <div class="bg-white dark:bg-gray-900 rounded-xl p-6 shadow">
    <h2 class="text-lg font-semibold mb-4">Employee Performance</h2>

    <table class="w-full text-sm">
      <thead>
      <tr class="border-b">
        <th class="text-left py-2">Employee</th>
        <th class="text-right py-2">Revenue</th>
      </tr>
      </thead>

      <tbody>
      <tr v-for="e in employees" :key="e.name" class="border-b">
        <td class="py-2">{{ e.name }}</td>
        <td class="py-2 text-right font-semibold">
          R {{ Number(e.revenue).toFixed(2) }}
        </td>
      </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dashboardApi } from '@/api/dashboard.api'

const employees = ref<any[]>([])

onMounted(async () => {
  const { data } = await dashboardApi.getEmployees()
  employees.value = data
})
</script>
