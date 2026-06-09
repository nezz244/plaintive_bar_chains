import express from 'express'
import db from '../db.js'
import { authenticate } from '../middleware/auth.mjs'
import {
  generateOrderNumber,
  getBranch,
  getActiveShift,
  fetchOrderReceipt,
  updateShiftSales,
} from '../lib/orderHelpers.mjs'
import { recordStockMovement, refreshShiftSoldQty } from '../lib/stockHelpers.mjs'
import { verifyAndCharge } from '../lib/yoco.mjs'
import { voidOrder, refundOrder, completeOrderOnTab } from '../lib/orderOperations.mjs'
import { requireManagerOrAdmin } from '../lib/employeeAuth.mjs'
import { logAudit } from './auth.routes.mjs'

const router = express.Router()
router.use(authenticate)

// POST /api/pos/:branchId/verify-pin — identify employee by PIN
router.post('/:branchId/verify-pin', async (req, res) => {
  const { pinCode } = req.body
  if (!pinCode) return res.status(400).json({ error: 'PIN is required' })

  try {
    const branch = await getBranch(db, req.params.branchId, req.user.company_id)
    if (!branch) return res.status(404).json({ error: 'Branch not found' })

    const { findEmployeeByPin } = await import('../lib/employeeAuth.mjs')
    const employee = await findEmployeeByPin(db, branch.id, branch.company_id, pinCode)
    if (!employee) return res.status(401).json({ error: 'Invalid PIN' })

    res.json({
      employee: {
        id: employee.id,
        firstName: employee.first_name,
        lastName: employee.last_name,
        role: employee.role,
        employeeCode: employee.employee_code,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'PIN verification failed' })
  }
})

// GET /api/pos/:branchId/products
router.get('/:branchId/products', async (req, res) => {
  try {
    const branch = await getBranch(db, req.params.branchId, req.user.company_id)
    if (!branch) return res.status(404).json({ error: 'Branch not found' })

    const [products] = await db.query(
      `SELECT p.id, p.name, p.sku, p.category, p.selling_price, p.send_to_kitchen,
              COALESCE(bs.units_available, 0) AS stock
       FROM products p
       LEFT JOIN branch_stock bs ON bs.product_id = p.id AND bs.branch_id = ?
       WHERE p.company_id = ? AND p.is_active = TRUE
       ORDER BY p.category, p.name`,
      [branch.id, branch.company_id]
    )
    res.json({ products })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch products' })
  }
})

// GET /api/pos/:branchId/context — shift, tables, tabs, yoco config
router.get('/:branchId/context', async (req, res) => {
  try {
    const branch = await getBranch(db, req.params.branchId, req.user.company_id)
    if (!branch) return res.status(404).json({ error: 'Branch not found' })

    const [[shift]] = await db.query(
      `SELECT s.*, CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM shifts s JOIN employees e ON e.id = s.employee_id
       WHERE s.branch_id = ? AND s.user_id = ? AND s.status = 'open'
       ORDER BY s.start_time DESC LIMIT 1`,
      [branch.id, req.user.id]
    )

    const [tables] = await db.query(
      "SELECT id, table_number, label, capacity, zone, status FROM venue_tables WHERE branch_id = ? AND is_active = TRUE ORDER BY table_number",
      [branch.id]
    )

    const [tabs] = await db.query(
      "SELECT id, tab_name, customer_name, table_id, total_amount FROM tabs WHERE branch_id = ? AND status = 'open' ORDER BY opened_at DESC",
      [branch.id]
    )

    const [employees] = await db.query(
      'SELECT id, first_name, last_name, role FROM employees WHERE branch_id = ? AND is_active = TRUE ORDER BY first_name',
      [branch.id]
    )

    const [[company]] = await db.query(
      'SELECT currency, tax_rate, yoco_public_key, receipt_footer FROM companies WHERE id = ?',
      [req.user.company_id]
    )

    res.json({
      branch,
      shift: shift || null,
      tables,
      tabs,
      employees,
      yocoEnabled: !!company?.yoco_public_key,
      publicKey: company?.yoco_public_key,
      currency: company?.currency || 'USD',
      taxRate: Number(company?.tax_rate || 0),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch POS context' })
  }
})

// POST /api/pos/:branchId/orders
router.post('/:branchId/orders', async (req, res) => {
  const {
    items,
    employeeId,
    orderType = 'bar_tab',
    tableId,
    tabId,
    paymentMethod = 'cash',
    notes,
    yocoToken,
    payLater = false,
    amountTendered,
  } = req.body

  if (!items?.length) {
    return res.status(400).json({ error: 'Order must have at least one item' })
  }

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const branch = await getBranch(conn, req.params.branchId, req.user.company_id)
    if (!branch) {
      await conn.rollback()
      return res.status(404).json({ error: 'Branch not found' })
    }

    const shift = await getActiveShift(conn, branch.id, req.user.id)
    if (!shift && !payLater) {
      await conn.rollback()
      return res.status(403).json({ error: 'Open a shift before processing sales' })
    }

    const [[fullShift]] = shift
      ? await conn.query('SELECT id, employee_id FROM shifts WHERE id = ?', [shift.id])
      : [[null]]
    const saleEmployeeId = employeeId || fullShift?.employee_id || null

    const [[company]] = await conn.query(
      'SELECT tax_rate, currency FROM companies WHERE id = ?',
      [req.user.company_id]
    )
    const taxRate = Number(company?.tax_rate || 0)

    const orderNumber = generateOrderNumber()
    let subtotal = 0
    let hasKitchenItems = false

    const isPaid = !payLater && paymentMethod !== 'tab'
    const orderStatus = payLater || paymentMethod === 'tab' ? 'open' : 'completed'
    const paymentStatus = payLater || paymentMethod === 'tab' ? 'pending' : 'paid'

    const [orderResult] = await conn.query(
      `INSERT INTO orders (company_id, branch_id, shift_id, order_number, employee_id, user_id,
         table_id, tab_id, order_type, payment_method, payment_status, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        branch.company_id, branch.id, shift?.id || null, orderNumber,
        saleEmployeeId, req.user.id, tableId || null, tabId || null,
        orderType, paymentMethod, paymentStatus, notes || null, orderStatus,
      ]
    )
    const orderId = orderResult.insertId

    for (const item of items) {
      const [[product]] = await conn.query(
        'SELECT id, selling_price, send_to_kitchen, name FROM products WHERE id = ? AND company_id = ?',
        [item.productId, branch.company_id]
      )
      if (!product) throw new Error(`Product not found`)

      const unitPrice = Number(product.selling_price)
      const totalPrice = unitPrice * item.quantity
      subtotal += totalPrice

      const kitchenStatus = product.send_to_kitchen ? 'pending' : 'none'
      if (product.send_to_kitchen) hasKitchenItems = true

      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, kitchen_status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, product.id, item.quantity, unitPrice, totalPrice, kitchenStatus, item.notes || null]
      )

      if (orderStatus === 'completed') {
        const [[stock]] = await conn.query(
          'SELECT units_available FROM branch_stock WHERE branch_id = ? AND product_id = ? FOR UPDATE',
          [branch.id, product.id]
        )
        if (stock && stock.units_available < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`)
        }
        if (stock) {
          await conn.query(
            'UPDATE branch_stock SET units_available = units_available - ? WHERE branch_id = ? AND product_id = ?',
            [item.quantity, branch.id, product.id]
          )
          await recordStockMovement(conn, {
            companyId: branch.company_id,
            branchId: branch.id,
            productId: product.id,
            movementType: 'sale',
            quantity: -item.quantity,
            referenceType: 'order',
            referenceId: orderId,
            shiftId: shift?.id || null,
            userId: req.user.id,
          })
        }
      }
    }

    if (shift?.id && orderStatus === 'completed') {
      await refreshShiftSoldQty(conn, shift.id)
    }

    const taxAmount = subtotal * (taxRate / 100)
    const totalAmount = subtotal + taxAmount
    const kitchenStatus = hasKitchenItems ? 'pending' : 'none'

    await conn.query(
      `UPDATE orders SET subtotal = ?, tax_amount = ?, total_amount = ?,
         kitchen_status = ?, completed_at = ?
       WHERE id = ?`,
      [subtotal, taxAmount, totalAmount, kitchenStatus, isPaid ? new Date() : null, orderId]
    )

    if (tableId && orderType === 'dine_in') {
      await conn.query("UPDATE venue_tables SET status = 'occupied' WHERE id = ?", [tableId])
    }

    if (tabId) {
      await conn.query(
        'UPDATE tabs SET subtotal = subtotal + ?, total_amount = total_amount + ? WHERE id = ?',
        [subtotal, totalAmount, tabId]
      )
    }

    if (isPaid) {
      if (paymentMethod === 'yoco' && yocoToken) {
        const amountInCents = Math.round(totalAmount * 100)
        const charge = await verifyAndCharge(
          req.user.company_id,
          yocoToken,
          amountInCents,
          company.currency || 'ZAR',
          { orderNumber, branchId: branch.id }
        )
        await conn.query(
          `INSERT INTO payments (order_id, amount, method, status, yoco_token, yoco_charge_id)
           VALUES (?, ?, 'yoco', 'completed', ?, ?)`,
          [orderId, totalAmount, yocoToken, charge.id]
        )
      } else if (paymentMethod !== 'tab') {
        await conn.query(
          `INSERT INTO payments (order_id, amount, method, status, reference)
           VALUES (?, ?, ?, 'completed', ?)`,
          [orderId, totalAmount, paymentMethod, amountTendered ? `Tendered: ${amountTendered}` : null]
        )
      }

      if (shift) {
        await updateShiftSales(conn, shift.id, paymentMethod, totalAmount)
      }
    }

    await conn.commit()

    const receipt = await fetchOrderReceipt(db, orderId, req.user.company_id)
    res.status(201).json({ order: receipt.order, items: receipt.items, payments: receipt.payments, receipt })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(400).json({ error: err.message || 'Failed to create order' })
  } finally {
    conn.release()
  }
})

// POST /api/pos/:branchId/orders/:orderId/void
router.post('/:branchId/orders/:orderId/void', async (req, res) => {
  const { reason, managerPin } = req.body
  const conn = await db.getConnection()

  try {
    await conn.beginTransaction()

    const branch = await getBranch(conn, req.params.branchId, req.user.company_id)
    if (!branch) {
      await conn.rollback()
      return res.status(404).json({ error: 'Branch not found' })
    }

    const [[order]] = await conn.query(
      'SELECT * FROM orders WHERE id = ? AND branch_id = ? AND company_id = ?',
      [req.params.orderId, branch.id, req.user.company_id]
    )
    if (!order) {
      await conn.rollback()
      return res.status(404).json({ error: 'Order not found' })
    }

    if (order.status === 'completed') {
      const approver = await requireManagerOrAdmin(req, conn, branch.id, req.user.company_id, managerPin)
      if (!approver) {
        await conn.rollback()
        return res.status(403).json({ error: 'Manager PIN required to void a completed sale' })
      }
    }

    await voidOrder(conn, order, { userId: req.user.id, reason, companyId: req.user.company_id })
    await logAudit(req.user.company_id, req.user.id, 'order.voided', 'order', order.id, { reason }, req)
    await conn.commit()

    res.json({ message: 'Order voided' })
  } catch (err) {
    await conn.rollback()
    res.status(400).json({ error: err.message || 'Void failed' })
  } finally {
    conn.release()
  }
})

// POST /api/pos/:branchId/orders/:orderId/refund
router.post('/:branchId/orders/:orderId/refund', async (req, res) => {
  const { reason, managerPin, amount } = req.body
  const conn = await db.getConnection()

  try {
    await conn.beginTransaction()

    const branch = await getBranch(conn, req.params.branchId, req.user.company_id)
    if (!branch) {
      await conn.rollback()
      return res.status(404).json({ error: 'Branch not found' })
    }

    const approver = await requireManagerOrAdmin(req, conn, branch.id, req.user.company_id, managerPin)
    if (!approver) {
      await conn.rollback()
      return res.status(403).json({ error: 'Manager PIN required for refunds' })
    }

    const [[order]] = await conn.query(
      'SELECT * FROM orders WHERE id = ? AND branch_id = ? AND company_id = ?',
      [req.params.orderId, branch.id, req.user.company_id]
    )
    if (!order) {
      await conn.rollback()
      return res.status(404).json({ error: 'Order not found' })
    }

    const result = await refundOrder(conn, order, {
      userId: req.user.id,
      reason,
      companyId: req.user.company_id,
      partialAmount: amount,
    })
    await logAudit(req.user.company_id, req.user.id, 'order.refunded', 'order', order.id, { reason, amount: result.refundedAmount }, req)
    await conn.commit()

    res.json({ message: 'Refund processed', ...result })
  } catch (err) {
    await conn.rollback()
    res.status(400).json({ error: err.message || 'Refund failed' })
  } finally {
    conn.release()
  }
})

// GET /api/pos/orders/:orderId/receipt
router.get('/orders/:orderId/receipt', async (req, res) => {
  try {
    const receipt = await fetchOrderReceipt(db, req.params.orderId, req.user.company_id)
    if (!receipt) return res.status(404).json({ error: 'Order not found' })
    res.json(receipt)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch receipt' })
  }
})

// GET /api/pos/:branchId/orders/today
router.get('/:branchId/orders/today', async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT o.id, o.order_number, o.total_amount, o.payment_method, o.order_type,
              o.status, o.payment_status, o.kitchen_status, o.created_at, o.completed_at,
              vt.table_number, t.tab_name,
              CONCAT(e.first_name, ' ', e.last_name) AS employee_name
       FROM orders o
       LEFT JOIN employees e ON e.id = o.employee_id
       LEFT JOIN venue_tables vt ON vt.id = o.table_id
       LEFT JOIN tabs t ON t.id = o.tab_id
       WHERE o.branch_id = ? AND DATE(o.created_at) = CURDATE()
       ORDER BY o.created_at DESC`,
      [req.params.branchId]
    )
    res.json({ orders })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch orders' })
  }
})

// POST /api/pos/products
router.post('/products', async (req, res) => {
  const { name, sku, category, buyingPrice, sellingPrice, unitsPerCase = 1, sendToKitchen = false, branchIds = [] } = req.body

  if (!name || sellingPrice == null) {
    return res.status(400).json({ error: 'Name and selling price are required' })
  }

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [result] = await conn.query(
      `INSERT INTO products (company_id, name, sku, category, buying_price, selling_price, units_per_case, send_to_kitchen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.company_id, name, sku || null, category || null, buyingPrice || 0, sellingPrice, unitsPerCase, sendToKitchen]
    )
    const productId = result.insertId

    const [branches] = await conn.query(
      'SELECT id FROM branches WHERE company_id = ? AND is_active = TRUE',
      [req.user.company_id]
    )

    const [[company]] = await conn.query(
      'SELECT warehouse_mode FROM companies WHERE id = ?',
      [req.user.company_id]
    )
    const warehouseMode = company?.warehouse_mode || 'central'

    const targetBranches = branchIds.length ? branchIds : branches.map((b) => b.id)
    for (const branchId of targetBranches) {
      await conn.query(
        'INSERT INTO branch_stock (branch_id, product_id, units_available) VALUES (?, ?, 0)',
        [branchId, productId]
      )
      if (warehouseMode === 'per_branch') {
        await conn.query(
          'INSERT INTO warehouse_stock (company_id, branch_id, product_id, cases_available) VALUES (?, ?, ?, 0)',
          [req.user.company_id, branchId, productId]
        )
      }
    }

    if (warehouseMode === 'central') {
      await conn.query(
        'INSERT INTO warehouse_stock (company_id, branch_id, product_id, cases_available) VALUES (?, NULL, ?, 0)',
        [req.user.company_id, productId]
      )
    }

    await conn.commit()
    const [[product]] = await db.query('SELECT * FROM products WHERE id = ?', [productId])
    res.status(201).json({ product })
  } catch (err) {
    await conn.rollback()
    console.error(err)
    res.status(500).json({ error: 'Failed to create product' })
  } finally {
    conn.release()
  }
})

export default router
