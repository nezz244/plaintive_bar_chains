<template>
  <div v-if="show" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/60">
    <div class="w-full max-w-md mx-4 rounded-2xl bg-gray-800 p-6 text-white text-center">
      <h2 class="text-lg font-semibold mb-2">Yoco Card Payment</h2>
      <p class="text-2xl font-bold text-brand-400 mb-1">{{ currencySymbol }}{{ amount.toFixed(2) }}</p>
      <p class="text-sm text-gray-400 mb-6">A secure Yoco payment window will open</p>
      <p v-if="error" class="text-sm text-red-400 mb-4">{{ error }}</p>
      <div class="flex gap-3">
        <button type="button" @click="$emit('close')" class="flex-1 py-2.5 text-sm bg-gray-700 rounded-lg">Cancel</button>
        <button @click="pay" :disabled="processing" class="flex-1 py-2.5 text-sm font-medium bg-brand-500 rounded-lg disabled:opacity-50">
          {{ processing ? 'Processing...' : 'Pay with Yoco' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

declare global {
  interface Window {
    YocoSDK: new (opts: { publicKey: string }) => {
      showPopup: (opts: {
        amountInCents: number
        currency: string
        name?: string
        description?: string
        metadata?: Record<string, string>
      }) => Promise<{ id: string; status?: string }>
    }
  }
}

const props = defineProps<{
  show: boolean
  amount: number
  publicKey: string
  currency?: string
  orderLabel?: string
}>()

const emit = defineEmits<{ close: []; success: [token: string] }>()

const processing = ref(false)
const error = ref('')

const currencySymbol = computed(() => (props.currency === 'ZAR' ? 'R' : '$'))

function loadYocoSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.YocoSDK) return resolve()
    const existing = document.querySelector('script[src*="yoco-sdk"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = 'https://js.yoco.com/sdk/v1/yoco-sdk-web.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Yoco SDK'))
    document.head.appendChild(script)
  })
}

async function pay() {
  if (!props.publicKey) {
    error.value = 'Yoco is not configured'
    return
  }

  processing.value = true
  error.value = ''

  try {
    await loadYocoSdk()
    const yoco = new window.YocoSDK({ publicKey: props.publicKey })
    const amountInCents = Math.round(props.amount * 100)

    const result = await yoco.showPopup({
      amountInCents,
      currency: props.currency || 'ZAR',
      name: props.orderLabel || 'VenuePOS Sale',
      description: 'Point of sale payment',
    })

    if (result?.id) {
      emit('success', result.id)
    } else {
      throw new Error('No payment token received')
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Payment cancelled or failed'
    if (!msg.toLowerCase().includes('cancel')) {
      error.value = msg
    }
  } finally {
    processing.value = false
  }
}
</script>
