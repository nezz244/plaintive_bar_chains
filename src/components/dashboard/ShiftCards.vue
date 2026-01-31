<template>
  <div class="bg-white dark:bg-gray-900 rounded-xl p-6 shadow">
    <h2 class="text-lg font-semibold mb-4">Shift Revenue</h2>

    <div
      v-for="s in shifts"
      :key="s.employee_name"
      class="flex justify-between py-2 border-b"
    >
      <span>{{ s.employee_name }}</span>
      <span class="font-semibold">
        R {{ Number(s.revenue).toFixed(2) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dashboardApi } from '@/api/dashboard.api'

const shifts = ref<any[]>([])

onMounted(async () => {
  const { data } = await dashboardApi.getShifts(barSlug)
  shifts.value = data
})
</script>
