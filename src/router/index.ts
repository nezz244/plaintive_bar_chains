import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { left: 0, top: 0 }
  },
  routes: [
    {
      path: '/signin',
      name: 'Signin',
      component: () => import('../views/Auth/Signin.vue'),
      meta: { title: 'Sign In', guest: true },
    },
    {
      path: '/signup',
      name: 'Signup',
      component: () => import('../views/Auth/Onboarding.vue'),
      meta: { title: 'Get Started', guest: true },
    },
    {
      path: '/',
      name: 'Overview',
      component: () => import('../views/admin/Overview.vue'),
      meta: { title: 'Dashboard', requiresAuth: true },
    },
    {
      path: '/admin/branches',
      name: 'Branches',
      component: () => import('../views/admin/Branches.vue'),
      meta: { title: 'Branches', requiresAuth: true },
    },
    {
      path: '/admin/tables',
      name: 'Tables',
      component: () => import('../views/admin/Tables.vue'),
      meta: { title: 'Floor Plan', requiresAuth: true },
    },
    {
      path: '/admin/employees',
      name: 'Employees',
      component: () => import('../views/admin/Employees.vue'),
      meta: { title: 'Team & Access', requiresAuth: true },
    },
    {
      path: '/admin/products',
      name: 'Products',
      component: () => import('../views/admin/Products.vue'),
      meta: { title: 'Products', requiresAuth: true },
    },
    {
      path: '/admin/shifts',
      name: 'Shifts',
      component: () => import('../views/admin/Shifts.vue'),
      meta: { title: 'Shifts', requiresAuth: true },
    },
    {
      path: '/admin/settings',
      name: 'Settings',
      component: () => import('../views/admin/Settings.vue'),
      meta: { title: 'Settings', requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/pos/:branchId',
      name: 'POSTerminal',
      component: () => import('../views/pos/Terminal.vue'),
      meta: { title: 'POS', requiresAuth: true },
    },
    {
      path: '/kitchen/:branchId',
      name: 'KitchenDisplay',
      component: () => import('../views/kitchen/Display.vue'),
      meta: { title: 'Kitchen', requiresAuth: true },
    },
    {
      path: '/error-404',
      name: '404 Error',
      component: () => import('../views/Errors/FourZeroFour.vue'),
      meta: { title: '404 Error' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/error-404',
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  document.title = `${to.meta.title || 'VenuePOS'} | VenuePOS`
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    if (auth.token && !auth.user) await auth.init()
    if (!auth.isAuthenticated) return next({ name: 'Signin', query: { redirect: to.fullPath } })
  }
  if (to.meta.guest && auth.isAuthenticated) return next({ name: 'Overview' })
  if (to.meta.requiresAdmin && !auth.isOwnerOrAdmin) return next({ name: 'Overview' })
  next()
})

export default router
