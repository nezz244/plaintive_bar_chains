<template>
  <FullScreenLayout>
    <div class="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div class="relative flex flex-col justify-center w-full min-h-screen lg:flex-row dark:bg-gray-900">
        <div class="flex flex-col flex-1 w-full lg:w-1/2">
          <div class="flex flex-col justify-center flex-1 w-full max-w-md px-6 py-12 mx-auto">
            <div class="mb-8">
              <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
                  <span class="text-white font-bold text-lg">V</span>
                </div>
                <span class="text-xl font-bold text-gray-800 dark:text-white">VenuePOS</span>
              </div>
              <h1 class="text-2xl font-semibold text-gray-800 dark:text-white mb-2">Sign in</h1>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Enter your credentials to access your dashboard
              </p>
            </div>

            <form @submit.prevent="handleSubmit" class="space-y-5">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                <input
                  v-model="email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  class="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
                <div class="relative">
                  <input
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    required
                    placeholder="Enter your password"
                    class="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                  <button
                    type="button"
                    @click="showPassword = !showPassword"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                  >
                    {{ showPassword ? 'Hide' : 'Show' }}
                  </button>
                </div>
              </div>

              <p v-if="auth.error" class="text-sm text-red-500">{{ auth.error }}</p>

              <button
                type="submit"
                :disabled="auth.loading"
                class="w-full py-3.5 text-sm font-semibold text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition"
              >
                {{ auth.loading ? 'Signing in...' : 'Sign In' }}
              </button>

              <p class="text-sm text-center text-gray-500">
                Don't have an account?
                <router-link to="/signup" class="text-brand-500 hover:text-brand-600">Get started free</router-link>
              </p>
            </form>
          </div>
        </div>

        <div class="relative items-center hidden w-full lg:flex lg:w-1/2 bg-brand-950">
          <div class="max-w-md px-12">
            <h2 class="text-3xl font-bold text-white mb-4">Your venue, fully in control</h2>
            <p class="text-gray-300 leading-relaxed">
              Manage sales, staff, and inventory across all your bars, clubs, and restaurants from a single web dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  </FullScreenLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import FullScreenLayout from '@/components/layout/FullScreenLayout.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)

async function handleSubmit() {
  try {
    await auth.login(email.value, password.value)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch {
    // error shown via auth.error
  }
}
</script>
