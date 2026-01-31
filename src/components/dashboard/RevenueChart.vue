<template>
  <div class="bg-white dark:bg-gray-900 rounded-xl p-6 shadow">
    <h2 class="text-lg font-semibold mb-4">Daily Revenue</h2>
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dashboardApi } from '@/api/dashboard.api'
import Chart from 'chart.js/auto'

const canvas = ref<HTMLCanvasElement | null>(null)

onMounted(async () => {
  const { data } = await dashboardApi.getDailySales()

  new Chart(canvas.value!, {
    type: 'bar',
    data: {
      labels: data.map((d: any) => d.day),
      datasets: [
        {
          label: 'Revenue',
          data: data.map((d: any) => d.total),
        },
      ],
    },
  })
})
</script>
