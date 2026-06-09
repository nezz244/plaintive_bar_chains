<template>
  <div ref="receiptEl" class="receipt-print bg-white text-black p-6 max-w-sm mx-auto font-mono text-sm">
    <div class="text-center mb-4">
      <h1 class="text-lg font-bold">{{ receipt.order.company_name }}</h1>
      <p class="text-xs text-gray-600">{{ receipt.order.branch_name }}</p>
      <p v-if="receipt.order.branch_address" class="text-xs text-gray-600">{{ receipt.order.branch_address }}</p>
    </div>

    <div class="border-t border-b border-dashed border-gray-400 py-2 mb-3 text-xs space-y-1">
      <div class="flex justify-between">
        <span>Order</span>
        <span>{{ receipt.order.order_number }}</span>
      </div>
      <div class="flex justify-between">
        <span>Date</span>
        <span>{{ formatDate(receipt.order.completed_at || receipt.order.created_at) }}</span>
      </div>
      <div v-if="receipt.order.table_number" class="flex justify-between">
        <span>Table</span>
        <span>{{ receipt.order.table_label || receipt.order.table_number }}</span>
      </div>
      <div v-if="receipt.order.tab_name" class="flex justify-between">
        <span>Tab</span>
        <span>{{ receipt.order.tab_name }}</span>
      </div>
      <div v-if="receipt.order.employee_name" class="flex justify-between">
        <span>Served by</span>
        <span>{{ receipt.order.employee_name }}</span>
      </div>
    </div>

    <div class="space-y-2 mb-3">
      <div v-for="(item, i) in receipt.items" :key="i" class="flex justify-between text-xs">
        <span>{{ item.quantity }}x {{ item.product_name }}</span>
        <span>{{ currency }}{{ Number(item.total_price).toFixed(2) }}</span>
      </div>
    </div>

    <div class="border-t border-dashed border-gray-400 pt-2 space-y-1 text-xs">
      <div class="flex justify-between">
        <span>Subtotal</span>
        <span>{{ currency }}{{ Number(receipt.order.subtotal).toFixed(2) }}</span>
      </div>
      <div v-if="Number(receipt.order.tax_amount) > 0" class="flex justify-between">
        <span>Tax</span>
        <span>{{ currency }}{{ Number(receipt.order.tax_amount).toFixed(2) }}</span>
      </div>
      <div class="flex justify-between font-bold text-base pt-1">
        <span>TOTAL</span>
        <span>{{ currency }}{{ Number(receipt.order.total_amount).toFixed(2) }}</span>
      </div>
      <div v-for="(p, i) in receipt.payments" :key="i" class="flex justify-between text-gray-600">
        <span class="capitalize">{{ p.method }}</span>
        <span>{{ currency }}{{ Number(p.amount).toFixed(2) }}</span>
      </div>
    </div>

    <p v-if="receipt.order.receipt_footer" class="text-center text-xs text-gray-500 mt-4 pt-2 border-t border-dashed">
      {{ receipt.order.receipt_footer }}
    </p>
    <p class="text-center text-xs text-gray-400 mt-2">Thank you!</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  receipt: {
    order: Record<string, unknown>
    items: Array<{ quantity: number; product_name: string; total_price: number }>
    payments: Array<{ method: string; amount: number }>
  }
  currency?: string
}>()

const receiptEl = ref<HTMLElement | null>(null)

function formatDate(d: string) {
  return new Date(d).toLocaleString()
}

function print() {
  const content = receiptEl.value
  if (!content) return
  const win = window.open('', '_blank', 'width=400,height=600')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><title>Receipt</title>
    <style>body{font-family:monospace;margin:0;padding:16px}@media print{body{padding:0}}</style></head><body>${content.innerHTML}</body></html>`)
  win.document.close()
  win.focus()
  win.print()
  win.close()
}

defineExpose({ print })
</script>

<style>
@media print {
  .receipt-print { max-width: 80mm; }
}
</style>
