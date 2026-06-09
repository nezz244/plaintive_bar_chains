import express from 'express'
import db from '../db.js'
import { authenticate } from '../middleware/auth.mjs'

const router = express.Router()
router.use(authenticate)

// GET /api/kitchen/:branchId/orders
router.get('/:branchId/orders', async (req, res) => {
  try {
    const [[branch]] = await db.query(
      'SELECT id FROM branches WHERE id = ? AND company_id = ?',
      [req.params.branchId, req.user.company_id]
    )
    if (!branch) return res.status(404).json({ error: 'Branch not found' })

    const [orders] = await db.query(
      `SELECT o.id, o.order_number, o.order_type, o.kitchen_status, o.created_at, o.notes,
              vt.table_number, vt.label AS table_label,
              t.tab_name,
              TIMESTAMPDIFF(MINUTE, o.created_at, NOW()) AS wait_minutes
       FROM orders o
       LEFT JOIN venue_tables vt ON vt.id = o.table_id
       LEFT JOIN tabs t ON t.id = o.tab_id
       WHERE o.branch_id = ?
         AND o.kitchen_status IN ('pending', 'in_progress', 'ready')
         AND o.status IN ('open', 'completed')
       ORDER BY o.created_at ASC`,
      [req.params.branchId]
    )

    for (const order of orders) {
      const [items] = await db.query(
        `SELECT oi.id, oi.quantity, oi.kitchen_status, oi.notes, p.name AS product_name
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ? AND oi.kitchen_status != 'none'
         ORDER BY oi.id`,
        [order.id]
      )
      order.items = items
    }

    res.json({ orders })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch kitchen orders' })
  }
})

// PATCH /api/kitchen/:branchId/orders/:orderId/status
router.patch('/:branchId/orders/:orderId/status', async (req, res) => {
  const { kitchenStatus } = req.body
  const valid = ['pending', 'in_progress', 'ready', 'served']
  if (!valid.includes(kitchenStatus)) {
    return res.status(400).json({ error: 'Invalid kitchen status' })
  }

  try {
    const [[order]] = await db.query(
      `SELECT o.id FROM orders o
       JOIN branches b ON b.id = o.branch_id
       WHERE o.id = ? AND o.branch_id = ? AND b.company_id = ?`,
      [req.params.orderId, req.params.branchId, req.user.company_id]
    )
    if (!order) return res.status(404).json({ error: 'Order not found' })

    await db.query('UPDATE orders SET kitchen_status = ? WHERE id = ?', [kitchenStatus, order.id])

    if (kitchenStatus === 'served') {
      await db.query(
        "UPDATE order_items SET kitchen_status = 'served' WHERE order_id = ? AND kitchen_status != 'none'",
        [order.id]
      )
    }

    res.json({ message: 'Order status updated', kitchenStatus })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update order status' })
  }
})

// PATCH /api/kitchen/:branchId/items/:itemId/status
router.patch('/:branchId/items/:itemId/status', async (req, res) => {
  const { kitchenStatus } = req.body
  const valid = ['pending', 'preparing', 'ready', 'served']
  if (!valid.includes(kitchenStatus)) {
    return res.status(400).json({ error: 'Invalid item status' })
  }

  try {
    const [[item]] = await db.query(
      `SELECT oi.id, oi.order_id FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN branches b ON b.id = o.branch_id
       WHERE oi.id = ? AND o.branch_id = ? AND b.company_id = ?`,
      [req.params.itemId, req.params.branchId, req.user.company_id]
    )
    if (!item) return res.status(404).json({ error: 'Item not found' })

    await db.query('UPDATE order_items SET kitchen_status = ? WHERE id = ?', [kitchenStatus, item.id])

    const [statuses] = await db.query(
      "SELECT kitchen_status FROM order_items WHERE order_id = ? AND kitchen_status != 'none'",
      [item.order_id]
    )

    let orderStatus = 'in_progress'
    if (statuses.every((s) => s.kitchen_status === 'ready' || s.kitchen_status === 'served')) {
      orderStatus = statuses.every((s) => s.kitchen_status === 'served') ? 'served' : 'ready'
    } else if (statuses.every((s) => s.kitchen_status === 'pending')) {
      orderStatus = 'pending'
    }

    await db.query('UPDATE orders SET kitchen_status = ? WHERE id = ?', [orderStatus, item.order_id])

    res.json({ message: 'Item status updated', kitchenStatus, orderKitchenStatus: orderStatus })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update item status' })
  }
})

export default router
