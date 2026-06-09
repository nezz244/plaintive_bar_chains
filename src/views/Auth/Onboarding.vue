<template>
  <FullScreenLayout>
    <div class="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div class="relative flex flex-col justify-center w-full min-h-screen lg:flex-row dark:bg-gray-900">
        <div class="flex flex-col flex-1 w-full lg:w-1/2">
          <div class="flex flex-col justify-center flex-1 w-full max-w-lg px-6 py-12 mx-auto lg:px-10">
            <div class="mb-8">
              <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
                  <span class="text-white font-bold text-lg">V</span>
                </div>
                <span class="text-xl font-bold text-gray-800 dark:text-white">VenuePOS</span>
              </div>
              <h1 class="text-2xl font-semibold text-gray-800 dark:text-white mb-2">
                Set up your business
              </h1>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Create your company account in minutes. Manage bars, restaurants, and clubs from one platform.
              </p>
            </div>

            <form @submit.prevent="handleSubmit" class="space-y-5">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Business Name *</label>
                <input
                  v-model="form.companyName"
                  required
                  placeholder="e.g. Sunset Hospitality Group"
                  class="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Business Type</label>
                <select v-model="form.businessType" class="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                  <option value="bar">Bar</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="club">Club / Nightclub</option>
                  <option value="multi">Multiple Venues</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">First Name *</label>
                  <input v-model="form.firstName" required class="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Last Name *</label>
                  <input v-model="form.lastName" required class="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Work Email *</label>
                <input v-model="form.email" type="email" required class="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password *</label>
                <input v-model="form.password" type="password" required minlength="8" placeholder="Min. 8 characters" class="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
              </div>

              <div class="pt-2 border-t border-gray-200 dark:border-gray-800">
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">First Location (optional)</p>
                <div class="grid grid-cols-2 gap-4">
                  <div class="col-span-2">
                    <input v-model="form.branchName" placeholder="Branch name e.g. Downtown Bar" class="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
                  </div>
                  <div>
                    <select v-model="form.branchType" class="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                      <option value="bar">Bar</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="club">Club</option>
                      <option value="lounge">Lounge</option>
                    </select>
                  </div>
                </div>
              </div>

              <p v-if="auth.error" class="text-sm text-red-500">{{ auth.error }}</p>

              <button
                type="submit"
                :disabled="auth.loading"
                class="w-full py-3.5 text-sm font-semibold text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition"
              >
                {{ auth.loading ? 'Creating account...' : 'Create Account & Get Started' }}
              </button>

              <p class="text-sm text-center text-gray-500">
                Already have an account?
                <router-link to="/signin" class="text-brand-500 hover:text-brand-600">Sign in</router-link>
              </p>
            </form>
          </div>
        </div>

        <div class="relative items-center hidden w-full lg:flex lg:w-1/2 bg-brand-950">
          <div class="max-w-md px-12">
            <h2 class="text-3xl font-bold text-white mb-4">Everything you need to run your venue</h2>
            <ul class="space-y-4 text-gray-300">
              <li class="flex items-start gap-3">
                <span class="mt-1 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-xs">✓</span>
                Multi-branch management for bars, clubs & restaurants
              </li>
              <li class="flex items-start gap-3">
                <span class="mt-1 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-xs">✓</span>
                Touch-friendly POS terminal for fast checkout
              </li>
              <li class="flex items-start gap-3">
                <span class="mt-1 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-xs">✓</span>
                Employee management with role-based access control
              </li>
              <li class="flex items-start gap-3">
                <span class="mt-1 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-xs">✓</span>
                Real-time sales analytics across all locations
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </FullScreenLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import FullScreenLayout from '@/components/layout/FullScreenLayout.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = ref({
  companyName: '',
  businessType: 'multi',
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  branchName: '',
  branchType: 'bar',
})

async function handleSubmit() {
  try {
    await auth.register(form.value)
    router.push('/')
  } catch {
    // error shown via auth.error
  }
}
</script>
