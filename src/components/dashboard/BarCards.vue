<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">

    <div
      v-for="bar in bars"
      :key="bar.bar_id"
      class="rounded-2xl border border-gray-200 bg-white p-5
             dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
      @click="openBar(bar.bar_name)"
    >
      <!-- ICON -->
      <div
        class="flex items-center justify-center w-12 h-12
               bg-gray-100 rounded-xl dark:bg-gray-800"
      >
        <!-- keep your svg -->
        <slot name="icon">
          <svg
            class="fill-gray-800 dark:fill-white/90"
            width="24"
            height="24"
            viewBox="0 0 24 24"
          >
            <path
              d="M8.8 5.6a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 0 0 0-4.4Z"
            />
          </svg>
        </slot>
      </div>

      <!-- CONTENT -->
      <div class="flex items-end justify-between mt-5">
        <div>
          <span class="text-sm text-gray-500 dark:text-gray-400">
            {{ bar.bar_name }}
          </span>

          <h4 class="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
            R {{ Number(bar.current_month).toLocaleString() }}
          </h4>
        </div>

        <!-- GROWTH -->
        <span
          class="flex items-center gap-1 rounded-full py-0.5 pl-2 pr-2.5 text-sm font-medium"
          :class="growth(bar) >= 0
            ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500'
            : 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'"
        >
          {{ growth(bar).toFixed(2) }}%
        </span>
      </div>

    </div>

  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{
  bars: any[]
}>()

const router = useRouter()

function openBar(barName: string) {
  router.push({
    name: 'Dashboard',
    query: { bar: barName }
  })
}

function growth(bar: any) {
  if (!bar.last_month || bar.last_month === 0) return 100
  return ((bar.current_month - bar.last_month) / bar.last_month) * 100
}
</script>
