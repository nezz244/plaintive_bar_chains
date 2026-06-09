<template>
  <admin-layout>
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-gray-800 dark:text-white">Company Settings</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Profile, payments, tax, and receipts</p>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">Loading...</div>

    <div v-else class="max-w-2xl space-y-6">
      <form @submit.prevent="saveProfile" class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-4">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">Company Profile</h2>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
          <input v-model="form.name" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
            <select v-model="form.currency" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
              <option value="USD">USD</option>
              <option value="ZWL">ZWL</option>
              <option value="ZAR">ZAR</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Rate (%)</label>
            <input v-model.number="form.taxRate" type="number" step="0.01" min="0" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Receipt Footer</label>
          <input v-model="form.receiptFooter" placeholder="e.g. Thank you for visiting!" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
        </div>
        <button type="submit" :disabled="saving" class="px-6 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg disabled:opacity-50">Save Profile</button>
      </form>

      <form @submit.prevent="saveYoco" class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] space-y-4">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">Yoco Payments</h2>
        <p class="text-sm text-gray-500">
          Connect your Yoco account to accept card payments at the POS.
          Get your integration keys from
          <a href="https://portal.yoco.com/online/settings/integration" target="_blank" class="text-brand-500">Yoco Portal → Integration</a>.
        </p>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Public Key</label>
          <input v-model="yocoForm.yocoPublicKey" placeholder="pk_test_..." class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Secret Key</label>
          <input v-model="yocoForm.yocoSecretKey" type="password" placeholder="sk_test_..." class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Webhook Secret (optional)</label>
          <input v-model="yocoForm.yocoWebhookSecret" type="password" placeholder="whsec_..." class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
        </div>
        <button type="submit" :disabled="savingYoco" class="px-6 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg disabled:opacity-50">Save Yoco Config</button>
      </form>

      <p v-if="message" class="text-sm text-green-600">{{ message }}</p>
      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import { companiesApi, paymentsApi } from '@/api/venuepos.api'

const loading = ref(true)
const saving = ref(false)
const savingYoco = ref(false)
const message = ref('')
const error = ref('')

const form = ref({ name: '', currency: 'USD', taxRate: 0, receiptFooter: '' })
const yocoForm = ref({ yocoPublicKey: '', yocoSecretKey: '', yocoWebhookSecret: '' })

async function load() {
  const { data } = await companiesApi.getCurrent()
  form.value = {
    name: data.company.name,
    currency: data.company.currency || 'USD',
    taxRate: Number(data.company.tax_rate || 0),
    receiptFooter: data.company.receipt_footer || '',
  }
}

async function saveProfile() {
  saving.value = true
  message.value = ''
  error.value = ''
  try {
    await companiesApi.updateCurrent(form.value)
    message.value = 'Profile saved'
  } catch (err: unknown) {
    error.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
  } finally {
    saving.value = false
  }
}

async function saveYoco() {
  savingYoco.value = true
  message.value = ''
  error.value = ''
  try {
    await paymentsApi.updateConfig(yocoForm.value)
    message.value = 'Yoco configuration saved'
  } catch (err: unknown) {
    error.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
  } finally {
    savingYoco.value = false
  }
}

onMounted(async () => {
  await load()
  loading.value = false
})
</script>
