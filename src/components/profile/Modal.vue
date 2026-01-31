<template>
  <div class="fixed inset-0 flex items-center justify-center z-50">
    <div
      class="fixed inset-0 bg-gray-400/50"
      @click="$emit('close')"
    ></div>

    <div class="relative bg-white p-6 rounded-xl z-10">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineEmits(['close'])
</script>
