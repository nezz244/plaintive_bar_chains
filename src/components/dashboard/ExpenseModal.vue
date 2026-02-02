<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
  >
    <div
      class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-lg transition-transform transform scale-100"
    >
      <!-- Header -->
      <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90 mb-5">Add Expense</h3>

      <!-- Form -->
      <div class="flex flex-col gap-4">
        <!-- Category -->
        <div class="relative">
          <input
            v-model="category"
            type="text"
            id="category"
            class="peer w-full rounded-lg border border-gray-300 bg-white px-3 pt-5 pb-2 text-sm text-gray-700 shadow-sm placeholder-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-brand-400 transition-colors"
            placeholder="Category"
          />
          <label
            for="category"
            class="absolute left-3 top-2 text-gray-500 text-xs transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-brand-500 dark:peer-focus:text-brand-400"
          >
            Category
          </label>
        </div>

        <!-- Amount -->
        <div class="relative">
          <input
            v-model.number="amount"
            type="number"
            id="amount"
            class="peer w-full rounded-lg border border-gray-300 bg-white px-3 pt-5 pb-2 text-sm text-gray-700 shadow-sm placeholder-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-brand-400 transition-colors"
            placeholder="Amount"
          />
          <label
            for="amount"
            class="absolute left-3 top-2 text-gray-500 text-xs transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-brand-500 dark:peer-focus:text-brand-400"
          >
            Amount
          </label>
        </div>

        <!-- Date -->
        <div class="relative">
          <input
            v-model="date"
            type="date"
            id="date"
            class="peer w-full rounded-lg border border-gray-300 bg-white px-3 pt-5 pb-2 text-sm text-gray-700 shadow-sm placeholder-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-brand-400 transition-colors"
          />
          <label
            for="date"
            class="absolute left-3 top-2 text-gray-500 text-xs transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-brand-500 dark:peer-focus:text-brand-400"
          >
            Date
          </label>
        </div>
      </div>

      <!-- Buttons -->
      <div class="mt-6 flex justify-end gap-3">
        <button
          @click="save"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white shadow hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700 transition-colors"
        >
          Save
        </button>
        <button
          @click="$emit('close')"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 shadow hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits(['save', 'close'])

const category = ref('')
const amount = ref<number | null>(null)
const date = ref('')

function save() {
  if (!category.value || !amount.value || !date.value) return
  emit('save', {
    category: category.value,
    amount: amount.value,
    expense_date: date.value
  })
  category.value = ''
  amount.value = null
  date.value = ''
}
</script>
