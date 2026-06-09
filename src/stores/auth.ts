import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

export interface BranchAccess {
  branch_id: number
  role: string
  branch_name: string
  branch_slug: string
  branch_type?: string
}

export interface User {
  id: number
  email: string
  firstName: string
  lastName: string
  companyRole: string
  companyId: number
  companyName: string
  companySlug: string
  branchAccess: BranchAccess[]
}

export interface Branch {
  id: number
  name: string
  slug: string
  branch_type: string
  is_active: boolean
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('venuepos_token'))
  const user = ref<User | null>(null)
  const branches = ref<Branch[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isOwnerOrAdmin = computed(() =>
    user.value ? ['owner', 'admin'].includes(user.value.companyRole) : false
  )
  const fullName = computed(() =>
    user.value ? `${user.value.firstName} ${user.value.lastName}` : ''
  )

  function setSession(newToken: string, newUser: User) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem('venuepos_token', newToken)
  }

  function clearSession() {
    token.value = null
    user.value = null
    branches.value = []
    localStorage.removeItem('venuepos_token')
  }

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setSession(data.token, data.user)
      await fetchMe()
      return data
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      error.value = msg || 'Login failed'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function register(payload: Record<string, unknown>) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.post('/auth/register', payload)
      setSession(data.token, data.user)
      await fetchMe()
      return data
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } }; message?: string }
      if (axiosErr.response?.status === 404) {
        error.value = 'API not reachable. Restart with npm run dev:all and ensure port 3001 is free.'
      } else {
        error.value = axiosErr.response?.data?.error || axiosErr.message || 'Registration failed'
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchMe() {
    if (!token.value) return
    try {
      const { data } = await api.get('/auth/me')
      user.value = data.user
      branches.value = data.branches
    } catch {
      clearSession()
    }
  }

  async function logout() {
    clearSession()
  }

  async function init() {
    if (token.value) {
      await fetchMe()
    }
  }

  return {
    token,
    user,
    branches,
    loading,
    error,
    isAuthenticated,
    isOwnerOrAdmin,
    fullName,
    login,
    register,
    fetchMe,
    logout,
    init,
    clearSession,
  }
})
