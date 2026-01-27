<template>
  <div class="grid grid-cols-12 gap-4 md:gap-6">
    <h2 class="col-span-12 text-2xl font-bold mb-4">{{ barName }} Bar Dashboard</h2>

    <!-- Fridge Stock -->
    <div class="col-span-12 xl:col-span-4">
      <FridgeStock />
    </div>

    <!-- Employees Table -->
    <div class="col-span-12 xl:col-span-8">
      <EmployeesTable :api-endpoint="employeesApi" />
    </div>

    <!-- Revenue Chart -->
    <div class="col-span-12">
      <RevenueChart />
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from 'vue'
import FridgeStock from './FridgeStock.vue'
import EmployeesTable from './EmployeesTable.vue'
import RevenueChart from './RevenueChart.vue'

const props = defineProps<{ barName: string }>()

// You can dynamically set API endpoint based on bar
const employeesApi = computed(() => `/api/employees?bar=${props.barName.toLowerCase()}`)
</script>
