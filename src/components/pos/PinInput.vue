<template>
  <div>
    <div class="flex gap-2 mb-3">
      <span
        v-for="i in length"
        :key="i"
        class="w-3 h-3 rounded-full border border-gray-500"
        :class="i <= modelValue.length ? 'bg-brand-500 border-brand-500' : ''"
      />
    </div>
    <input
      :value="modelValue"
      type="password"
      inputmode="numeric"
      maxlength="6"
      readonly
      class="w-full px-3 py-2.5 mb-3 text-center text-lg tracking-widest bg-gray-900 border border-gray-700 rounded-lg"
      placeholder="••••"
    />
    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="n in keys"
        :key="n"
        type="button"
        @click="press(n)"
        class="py-3 text-lg font-medium bg-gray-700 rounded-lg hover:bg-gray-600 active:bg-brand-600"
      >
        {{ n }}
      </button>
    </div>
    <button type="button" @click="clear" class="w-full mt-2 py-2 text-sm text-gray-400">Clear</button>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ modelValue: string; length?: number }>(), { length: 4 })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫']

function press(key: string) {
  if (key === 'C') return clear()
  if (key === '⌫') {
    emit('update:modelValue', props.modelValue.slice(0, -1))
    return
  }
  if (props.modelValue.length >= props.length) return
  emit('update:modelValue', props.modelValue + key)
}

function clear() {
  emit('update:modelValue', '')
}
</script>
