import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import db from './db.js'
import authRoutes from './routes/auth.routes.mjs'
import companyRoutes from './routes/companies.routes.mjs'
import branchRoutes from './routes/branches.routes.mjs'
import userRoutes from './routes/users.routes.mjs'
import posRoutes from './routes/pos.routes.mjs'
import tableRoutes from './routes/tables.routes.mjs'
import shiftRoutes from './routes/shifts.routes.mjs'
import kitchenRoutes from './routes/kitchen.routes.mjs'
import paymentRoutes, { yocoWebhookHandler } from './routes/payments.routes.mjs'
import expenseRoutes from './routes/expenses.routes.mjs'
import stockRoutes from './routes/stock.routes.mjs'
import reportRoutes from './routes/reports.routes.mjs'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), yocoWebhookHandler)

app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/companies', companyRoutes)
app.use('/api/branches', branchRoutes)
app.use('/api/users', userRoutes)
app.use('/api/pos', posRoutes)
app.use('/api/tables', tableRoutes)
app.use('/api/shifts', shiftRoutes)
app.use('/api/kitchen', kitchenRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/stock', stockRoutes)
app.use('/api/reports', reportRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'VenuePOS API', version: '2.0.0' })
})

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

async function start() {
  try {
    await db.query('SELECT 1')
    console.log('Database connected')
  } catch (err) {
    console.warn('Database connection failed — run: npm run db:setup')
    console.warn(err.message)
  }

  app.listen(PORT, () => {
    console.log(`VenuePOS API running on http://localhost:${PORT}`)
  })
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  start()
}

export default app
