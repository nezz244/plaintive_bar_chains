<template>
  <admin-layout>
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-gray-800 dark:text-white">
        Welcome back, {{ auth.fullName }}
      </h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {{ auth.user?.companyName }} — Company overview
      </p>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500">Loading dashboard...</div>

    <template v-else>
      <!-- KPI Cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-6 mb-6">
        <div
          v-for="kpi in kpis"
          :key="kpi.label"
          class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
        >
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ kpi.label }}</p>
          <p class="mt-2 text-2xl font-bold text-gray-800 dark:text-white">{{ kpi.value }}</p>
          <p v-if="kpi.change !== undefined" :class="kpi.change >= 0 ? 'text-green-500' : 'text-red-500'" class="text-xs mt-1">
            {{ kpi.change >= 0 ? '+' : '' }}{{ kpi.change }}% vs yesterday
          </p>
        </div>
      </div>

      <!-- Branches -->
      <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-white">Branches</h2>
          <router-link
            v-if="auth.isOwnerOrAdmin"
            to="/admin/branches"
            class="text-sm text-brand-500 hover:text-brand-600"
          >
            Manage branches →
          </router-link>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-800">
                <th class="px-5 py-3 text-left font-medium text-gray-500">Branch</th>
                <th class="px-5 py-3 text-left font-medium text-gray-500">Type</th>
                <th class="px-5 py-3 text-right font-medium text-gray-500">Today's Revenue</th>
                <th class="px-5 py-3 text-right font-medium text-gray-500">Orders</th>
                <th class="px-5 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="branch in dashboard?.branches"
                :key="branch.id"
                class="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-white/[0.02]"
              >
                <td class="px-5 py-4 font-medium text-gray-800 dark:text-white">{{ branch.name }}</td>
                <td class="px-5 py-4 capitalize text-gray-500">{{ branch.branch_type }}</td>
                <td class="px-5 py-4 text-right text-gray-800 dark:text-white">
                  ${{ Number(branch.today_revenue).toFixed(2) }}
                </td>
                <td class="px-5 py-4 text-right text-gray-500">{{ branch.today_orders }}</td>
                <td class="px-5 py-4 text-right">
                  <router-link
                    :to="`/pos/${branch.id}`"
                    class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-brand-500 bg-brand-50 rounded-lg hover:bg-brand-100 dark:bg-brand-500/10"
                  >
                    Open POS
                  </router-link>
                </td>
              </tr>
              <tr v-if="!dashboard?.branches?.length">
                <td colspan="5" class="px-5 py-8 text-center text-gray-500">
                  No branches yet.
                  <router-link v-if="auth.isOwnerOrAdmin" to="/admin/branches" class="text-brand-500 ml-1">
                    Add your first branch
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </admin-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { companiesApi } from '@/api/venuepos.api'

const auth = useAuthStore()
const loading = ref(true)
const dashboard = ref<{
  branches: Array<{ id: number; name: string; branch_type: string; today_revenue: number; today_orders: number }>
  totals: { todayRevenue: number; growth: number; todayOrders: number; activeEmployees: number; activeBranches: number }
} | null>(null)

const kpis = computed(() => {
  const t = dashboard.value?.totals
  return [
    { label: "Today's Revenue", value: `$${Number(t?.todayRevenue || 0).toFixed(2)}`, change: t?.growth },
    { label: "Today's Orders", value: t?.todayOrders ?? 0 },
    { label: 'Active Branches', value: t?.activeBranches ?? 0 },
    { label: 'Active Staff', value: t?.activeEmployees ?? 0 },
  ]
})

onMounted(async () => {
  try {
    const { data } = await companiesApi.getDashboard()
    dashboard.value = data
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
})
</script>
