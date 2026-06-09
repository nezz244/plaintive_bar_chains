<template>
  <admin-layout>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-gray-800 dark:text-white">Team & Access</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage employees and system access</p>
      </div>
      <div class="flex gap-2">
        <button
          @click="showEmployeeModal = true"
          class="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
        >
          + Add Staff
        </button>
        <button
          v-if="auth.isOwnerOrAdmin"
          @click="showUserModal = true"
          class="px-4 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600"
        >
          + Add User Access
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 p-1 bg-gray-100 rounded-lg w-fit dark:bg-gray-800">
      <button
        v-for="tab in ['employees', 'users']"
        :key="tab"
        @click="activeTab = tab"
        :class="activeTab === tab ? 'bg-white dark:bg-gray-900 text-brand-500 shadow-sm' : 'text-gray-500'"
        class="px-4 py-2 text-sm font-medium rounded-md capitalize transition"
      >
        {{ tab }}
      </button>
    </div>

    <!-- Employees Tab -->
    <div v-if="activeTab === 'employees'" class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <th class="px-5 py-3 text-left font-medium text-gray-500">Code</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Name</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Branch</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Role</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="emp in employees" :key="emp.id" class="border-b border-gray-100 dark:border-gray-800/50">
            <td class="px-5 py-4 font-mono text-xs text-gray-500">{{ emp.employee_code }}</td>
            <td class="px-5 py-4 font-medium text-gray-800 dark:text-white">{{ emp.first_name }} {{ emp.last_name }}</td>
            <td class="px-5 py-4 text-gray-500">{{ emp.branch_name || '—' }}</td>
            <td class="px-5 py-4 capitalize text-gray-500">{{ emp.role }}</td>
            <td class="px-5 py-4">
              <span :class="emp.is_active ? 'text-green-600' : 'text-red-500'" class="text-xs font-medium">
                {{ emp.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
          </tr>
          <tr v-if="!employees.length">
            <td colspan="5" class="px-5 py-8 text-center text-gray-500">No employees yet</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Users Tab -->
    <div v-if="activeTab === 'users'" class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <th class="px-5 py-3 text-left font-medium text-gray-500">Name</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Email</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Company Role</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Branch Access</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" class="border-b border-gray-100 dark:border-gray-800/50">
            <td class="px-5 py-4 font-medium text-gray-800 dark:text-white">{{ u.first_name }} {{ u.last_name }}</td>
            <td class="px-5 py-4 text-gray-500">{{ u.email }}</td>
            <td class="px-5 py-4 capitalize text-gray-500">{{ u.company_role }}</td>
            <td class="px-5 py-4 text-xs text-gray-500">{{ u.branch_roles || '—' }}</td>
            <td class="px-5 py-4">
              <span :class="u.is_active ? 'text-green-600' : 'text-red-500'" class="text-xs font-medium">
                {{ u.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add Staff Modal -->
    <div v-if="showEmployeeModal" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/50">
      <div class="w-full max-w-lg mx-4 rounded-2xl bg-white p-6 dark:bg-gray-900">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Add Staff Member</h2>
        <form @submit.prevent="createEmployee" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
              <input v-model="empForm.firstName" required class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
              <input v-model="empForm.lastName" required class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Branch</label>
            <select v-model="empForm.branchId" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
              <option :value="null">Unassigned</option>
              <option v-for="b in auth.branches" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
            <select v-model="empForm.role" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
              <option value="bartender">Bartender</option>
              <option value="cashier">Cashier</option>
              <option value="server">Server</option>
              <option value="manager">Manager</option>
              <option value="kitchen">Kitchen</option>
              <option value="host">Host</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">POS PIN (optional)</label>
            <input v-model="empForm.pinCode" maxlength="6" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          </div>
          <p v-if="formError" class="text-sm text-red-500">{{ formError }}</p>
          <div class="flex gap-3">
            <button type="button" @click="showEmployeeModal = false" class="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" :disabled="saving" class="flex-1 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg disabled:opacity-50">Add Staff</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add User Modal -->
    <div v-if="showUserModal" class="fixed inset-0 z-999999 flex items-center justify-center bg-black/50">
      <div class="w-full max-w-lg mx-4 rounded-2xl bg-white p-6 dark:bg-gray-900 max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Create User with Access</h2>
        <form @submit.prevent="createUser" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
              <input v-model="userForm.firstName" required class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
              <input v-model="userForm.lastName" required class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
            <input v-model="userForm.email" type="email" required class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password *</label>
            <input v-model="userForm.password" type="password" required minlength="8" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Role</label>
            <select v-model="userForm.companyRole" class="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div v-if="auth.branches.length">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Branch Access</label>
            <div v-for="b in auth.branches" :key="b.id" class="flex items-center gap-3 mb-2">
              <input type="checkbox" :value="b.id" v-model="userForm.selectedBranches" class="rounded" />
              <span class="text-sm text-gray-700 dark:text-gray-300 flex-1">{{ b.name }}</span>
              <select
                v-if="userForm.selectedBranches.includes(b.id)"
                v-model="userForm.branchRoles[b.id]"
                class="px-2 py-1 text-xs border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              >
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
                <option value="bartender">Bartender</option>
                <option value="server">Server</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>
          </div>
          <p v-if="formError" class="text-sm text-red-500">{{ formError }}</p>
          <div class="flex gap-3">
            <button type="button" @click="showUserModal = false" class="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" :disabled="saving" class="flex-1 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg disabled:opacity-50">Create User</button>
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
import { usersApi } from '@/api/venuepos.api'

const auth = useAuthStore()
const activeTab = ref('employees')
interface Employee {
  id: number
  employee_code: string
  first_name: string
  last_name: string
  branch_name?: string
  role: string
  is_active: boolean
}

interface SystemUser {
  id: number
  first_name: string
  last_name: string
  email: string
  company_role: string
  branch_roles?: string
  is_active: boolean
}

const employees = ref<Employee[]>([])
const users = ref<SystemUser[]>([])
const showEmployeeModal = ref(false)
const showUserModal = ref(false)
const saving = ref(false)
const formError = ref('')

const empForm = ref({ firstName: '', lastName: '', branchId: null as number | null, role: 'staff', pinCode: '' })
const userForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  companyRole: 'member',
  selectedBranches: [] as number[],
  branchRoles: {} as Record<number, string>,
})

async function loadData() {
  const [empRes, userRes] = await Promise.all([
    usersApi.listEmployees(),
    auth.isOwnerOrAdmin ? usersApi.list() : Promise.resolve({ data: { users: [] } }),
  ])
  employees.value = empRes.data.employees
  users.value = userRes.data.users
}

async function createEmployee() {
  saving.value = true
  formError.value = ''
  try {
    await usersApi.createEmployee(empForm.value)
    showEmployeeModal.value = false
    empForm.value = { firstName: '', lastName: '', branchId: null, role: 'staff', pinCode: '' }
    await loadData()
  } catch (err: unknown) {
    formError.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
  } finally {
    saving.value = false
  }
}

async function createUser() {
  saving.value = true
  formError.value = ''
  try {
    const branchAccess = userForm.value.selectedBranches.map((id) => ({
      branchId: id,
      role: userForm.value.branchRoles[id] || 'cashier',
    }))
    await usersApi.create({ ...userForm.value, branchAccess })
    showUserModal.value = false
    await loadData()
  } catch (err: unknown) {
    formError.value = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>
