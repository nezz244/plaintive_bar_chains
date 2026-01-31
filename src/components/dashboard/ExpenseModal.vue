<template>
  <div class="modal">
    <h3>Add Expense</h3>

    <input v-model="category" placeholder="Category" />
    <input v-model.number="amount" type="number" />
    <input v-model="date" type="date" />

    <div class="flex gap-3">
      <button class="btn" @click="save">Save</button>
      <button class="btn-outline" @click="$emit('close')">Cancel</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits(['save', 'close'])

const category = ref('')
const amount = ref(0)
const date = ref('')

function save() {
  emit('save', {
    category: category.value,
    amount: amount.value,
    expense_date: date.value
  })
}
</script>
