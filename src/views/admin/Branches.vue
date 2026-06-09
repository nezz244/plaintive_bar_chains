<template>
  <admin-layout>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-800 dark:text-white">Branches</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your venues and locations</p>
      </div>
      <button
        v-if="auth.isOwnerOrAdmin"
        @click="showCreate = true"
        class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600"
      >
        + Add Branch
      </button>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="branch in branches"
        :key="branch.id"
        class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <div class="flex items-start justify-between">
          <div>
            <h3 class="font-semibold text-gray-800 dark:text-white">{{ branch.name }}</h3>
            <span class="inline-block mt-1 px-2 py-0.5 text-xs capitalize rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {{ branch.branch_type }}
            </span>
          </div>
          <span
            :class="branch.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
            class="px-2 py-0.5 text-xs rounded-full"
          >
            {{ branch.is_active ? 'Active' : 'Inactive' }}
          </span>
        </div>
        <p v-if="branch.address" class="mt-3 text-sm text-gray-500">{{ branch.address }}</p>
        <div class="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <span>{{ branch.employee_count }} staff</span>
          <span>{{ branch.user_count }} users</span>
        </div>
        <div class="mt-4 flex gap-2">
          <router-link
            :to="`/pos/${branch.id}`"
            class="flex-1 text-center py-2 text-sm font-medium text-brand-500 bg-brand-50 rounded-lg hover:bg-brand-100 dark:bg-brand-500/10"
          >
            POS
          </router-link>
          <button
            v-if="auth.isOwnerOrAdmin"
            @click="editBranch(branch)"
            class="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          >
            Edit
          </button>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showCreate || editing" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/50">
      <div class="w-full max-w-lg mx-4 rounded-2xl bg-white p-6 dark:bg-gray-900">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          {{ editing ? 'Edit Branch' : 'Add New Branch' }}
        </h2>
        <form @submit.prevent="saveBranch" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input v-model="form.name" required class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select v-model="form.branchType" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
              <option value="bar">Bar</option>
              <option value="restaurant">Restaurant</option>
              <option value="club">Club</option>
              <option value="lounge">Lounge</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
            <textarea v-model="form.address" rows="2" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input v-model="form.phone" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input v-model="form.email" type="email" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
          </div>
          <p v-if="formError" class="text-sm text-red-500">{{ formError }}</p>
          <div class="flex gap-3 pt-2">
            <button type="button" @click="closeModal" class="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300">
              Cancel
            </button>
            <button type="submit" :disabled="saving" class="flex-1 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50">
              {{ saving ? 'Saving...' : editing ? 'Update' : 'Create Branch' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </admin-layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AdminLayout from '@/components/layout/AdminLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { branchesApi } from '@/api/venuepos.api'

const auth = useAuthStore()
const branches = ref<Array<{
  id: number
  name: string
  branch_type: string
  address?: string
  phone?: string
  email?: string
  is_active: boolean
  employee_count: number
  user_count: number
}>>([])
const showCreate = ref(false)
const editing = ref<(typeof branches.value)[0] | null>(null)
const saving = ref(false)
const formError = ref('')

const form = ref({
  name: '',
  branchType: 'bar',
  address: '',
  phone: '',
  email: '',
})

async function loadBranches() {
  const { data } = await branchesApi.list()
  branches.value = data.branches
}

function editBranch(branch: (typeof branches.value)[0]) {
  editing.value = branch
  form.value = {
    name: branch.name as string,
    branchType: branch.branch_type as string,
    address: (branch.address as string) || '',
    phone: (branch.phone as string) || '',
    email: (branch.email as string) || '',
  }
}

function closeModal() {
  showCreate.value = false
  editing.value = null
  form.value = { name: '', branchType: 'bar', address: '', phone: '', email: '' }
  formError.value = ''
}

async function saveBranch() {
  saving.value = true
  formError.value = ''
  try {
    if (editing.value) {
      await branchesApi.update(editing.value.id, form.value)
    } else {
      await branchesApi.create(form.value)
    }
    await loadBranches()
    await auth.fetchMe()
    closeModal()
  } catch (err: unknown) {
    formError.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to save'
  } finally {
    saving.value = false
  }
}

onMounted(loadBranches)
</script>
