<template>
  <div
    class="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6"
  >
    <div class="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Employees</h3>
      </div>

      <div class="flex items-center gap-3">
        <button class="btn">Filter</button>
        <button class="btn">See all</button>
      </div>
    </div>

    <div class="max-w-full overflow-x-auto custom-scrollbar">
      <table class="min-w-full">
        <thead>
        <tr class="border-t border-gray-100 dark:border-gray-800">
          <th class="py-3 text-left">Name</th>
          <th class="py-3 text-left">Role</th>
          <th class="py-3 text-left">Shift</th>
          <th class="py-3 text-left">Status</th>
        </tr>
        </thead>
        <tbody>
        <tr
          v-for="(employee, index) in employees"
          :key="index"
          class="border-t border-gray-100 dark:border-gray-800"
        >
          <td class="py-3 whitespace-nowrap">{{ employee.name }}</td>
          <td class="py-3 whitespace-nowrap">{{ employee.role }}</td>
          <td class="py-3 whitespace-nowrap">{{ employee.shift }}</td>
          <td class="py-3 whitespace-nowrap">
              <span
                :class="{
                  'rounded-full px-2 py-0.5 text-theme-xs font-medium': true,
                  'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500': employee.status === 'Active',
                  'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500': employee.status === 'Inactive',
                }"
              >
                {{ employee.status }}
              </span>
          </td>
        </tr>
        </tbody>
      </table>

      <div v-if="loading" class="text-center py-4 text-gray-500">Loading employees...</div>
      <div v-if="error" class="text-center py-4 text-red-500">{{ error }}</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Define a proper type for Employee
interface Employee {
  id: number | string
  name: string
  role: string
  shift: string
  status: 'Active' | 'Inactive'
}

const employees = ref<Employee[]>([])
const loading = ref(false)
const error = ref('')

// Replace with your API endpoint
const apiEndpoint = 'https://your-api.com/employees?bar=Dumms'

const fetchEmployees = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(apiEndpoint)
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
    const data: Employee[] = await res.json() // Type your API response
    employees.value = data
  } catch (err: unknown) {
    if (err instanceof Error) {
      error.value = err.message
    } else {
      error.value = 'Failed to load employees'
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchEmployees()
})
</script>
