import { recordStockMovement, refreshShiftSoldQty } from './stockHelpers.mjs'
import { reverseShiftSales } from './orderHelpers.mjs'

export async function restoreOrderStock(conn, { orderId, branchId, companyId, shiftId, userId, reason }) {
  const [items] = await conn.query(
    `SELECT oi.product_id, oi.quantity, p.name AS product_name
     FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [orderId]
  )

  for (const item of items) {
    await conn.query(
      `INSERT INTO branch_stock (branch_id, product_id, units_available)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE units_available = units_available + VALUES(units_available)`,
      [branchId, item.product_id, item.quantity]
    )
    await recordStockMovement(conn, {
      companyId,
      branchId,
      productId: item.product_id,
      movementType: 'adjustment',
      quantity: item.quantity,
      referenceType: 'order',
      referenceId: orderId,
      shiftId,
      userId,
      notes: reason || 'Stock restored (void/refund)',
    })
  }

  if (shiftId) await refreshShiftSoldQty(conn, shiftId)
}

export async function adjustTabTotals(conn, tabId, subtotalDelta, totalDelta) {
  if (!tabId) return
  await conn.query(
    `UPDATE tabs SET
       subtotal = GREATEST(0, subtotal + ?),
       total_amount = GREATEST(0, total_amount + ?)
     WHERE id = ?`,
    [subtotalDelta, totalDelta, tabId]
  )
}

export async function voidOrder(conn, order, { userId, reason, companyId }) {
  if (!['open', 'completed'].includes(order.status)) {
    throw new Error('Only open or completed orders can be voided')
  }

  if (order.status === 'completed') {
    await restoreOrderStock(conn, {
      orderId: order.id,
      branchId: order.branch_id,
      companyId,
      shiftId: order.shift_id,
      userId,
      reason: reason || 'Void',
    })
    if (order.shift_id && order.payment_status === 'paid') {
      await reverseShiftSales(conn, order.shift_id, order.payment_method, Number(order.total_amount))
    }
    await conn.query(
      "UPDATE payments SET status = 'refunded' WHERE order_id = ? AND status = 'completed'",
      [order.id]
    )
  }

  if (order.tab_id) {
    await adjustTabTotals(conn, order.tab_id, -Number(order.subtotal), -Number(order.total_amount))
  }

  await conn.query(
    `UPDATE orders SET status = 'voided', payment_status = 'refunded',
       notes = CONCAT(COALESCE(notes, ''), ?), completed_at = COALESCE(completed_at, NOW())
     WHERE id = ?`,
    [reason ? `\n[VOID] ${reason}` : '\n[VOID]', order.id]
  )
}

export async function refundOrder(conn, order, { userId, reason, companyId, partialAmount }) {
  if (order.status !== 'completed' || order.payment_status !== 'paid') {
    throw new Error('Only paid completed orders can be refunded')
  }

  const amount = partialAmount != null ? Number(partialAmount) : Number(order.total_amount)
  if (amount <= 0 || amount > Number(order.total_amount)) {
    throw new Error('Invalid refund amount')
  }

  const isFull = amount >= Number(order.total_amount)

  if (isFull) {
    await restoreOrderStock(conn, {
      orderId: order.id,
      branchId: order.branch_id,
      companyId,
      shiftId: order.shift_id,
      userId,
      reason: reason || 'Refund',
    })
  }

  if (order.shift_id) {
    await reverseShiftSales(conn, order.shift_id, order.payment_method, amount)
  }

  await conn.query(
    `INSERT INTO payments (order_id, amount, method, status, reference)
     VALUES (?, ?, ?, 'refunded', ?)`,
    [order.id, -amount, order.payment_method, reason || 'Refund']
  )

  await conn.query(
    `UPDATE orders SET
       status = ?,
       payment_status = ?,
       notes = CONCAT(COALESCE(notes, ''), ?)
     WHERE id = ?`,
    [
      isFull ? 'refunded' : 'completed',
      isFull ? 'refunded' : 'partial',
      reason ? `\n[REFUND $${amount.toFixed(2)}] ${reason}` : `\n[REFUND $${amount.toFixed(2)}]`,
      order.id,
    ]
  )

  return { refundedAmount: amount, isFull }
}

export async function completeOrderOnTab(conn, order, branch, shift, userId) {
  const [items] = await conn.query(
    `SELECT oi.product_id, oi.quantity, p.name AS product_name
     FROM order_items oi JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [order.id]
  )

  for (const item of items) {
    const [[stock]] = await conn.query(
      'SELECT units_available FROM branch_stock WHERE branch_id = ? AND product_id = ? FOR UPDATE',
      [branch.id, item.product_id]
    )
    if (stock && stock.units_available < item.quantity) {
      throw new Error(`Insufficient stock for ${item.product_name}`)
    }
    if (stock) {
      await conn.query(
        'UPDATE branch_stock SET units_available = units_available - ? WHERE branch_id = ? AND product_id = ?',
        [item.quantity, branch.id, item.product_id]
      )
      await recordStockMovement(conn, {
        companyId: branch.company_id,
        branchId: branch.id,
        productId: item.product_id,
        movementType: 'sale',
        quantity: -item.quantity,
        referenceType: 'order',
        referenceId: order.id,
        shiftId: shift?.id || null,
        userId,
      })
    }
  }

  await conn.query(
    `UPDATE orders SET status = 'completed', payment_status = 'paid', completed_at = NOW() WHERE id = ?`,
    [order.id]
  )

  if (shift?.id) await refreshShiftSoldQty(conn, shift.id)
}
