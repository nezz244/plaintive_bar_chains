import express from 'express';
import { db } from '../server.js';

const router = express.Router();

/* -----------------------------------
   GET BAR ID FROM NAME
------------------------------------ */
async function getBarId(bar) {
  const [rows] = await db.query(
    'SELECT id FROM bars WHERE LOWER(name) = ?',
    [bar.toLowerCase()]
  )

  if (!rows.length) throw new Error('Bar not found')
  return rows[0].id
}
// Record a new sale
// GET /api/bars/:bar/employees
// GET /api/bars/:bar/employees
router.get('/bars/:bar/employees', async (req, res) => {
  const barSlug = req.params.bar

  try {
    // 1️⃣ Get the bar ID from the slug
    const [[bar]] = await db.query(
      `SELECT id FROM bars WHERE name = ?`,
      [barSlug]
    )
    if (!bar) return res.status(404).json({ error: 'Bar not found' })

    // 2️⃣ Get employees for this bar
    const [employees] = await db.query(
      `SELECT id, name, role FROM employees WHERE bar_id = ? ORDER BY name ASC`,
      [bar.id]
    )

    // 3️⃣ Return the employee list
    res.json({ data: employees })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch employees' })
  }
})

// POST /api/bars/:bar/sales
router.post('/bars/:bar/sales', async (req, res) => {
  const barSlug = req.params.bar
  const { product_id, employee_id, quantity } = req.body

  try {
    // Get bar id from slug
    const [[bar]] = await db.query(`SELECT id FROM bars WHERE name = ?`, [barSlug])
    if (!bar) return res.status(404).json({ error: 'Bar not found' })

    // Get product selling price from DB
    const [[product]] = await db.query(
      `SELECT selling_price FROM products WHERE id = ?`,
      [product_id]
    )
    if (!product) return res.status(404).json({ error: 'Product not found' })

    const unit_price = Number(product.selling_price)
    const total_price = quantity * unit_price

    // Insert sale
    await db.query(
      `INSERT INTO sales (bar_id, product_id, employee_id, quantity, unit_price, total_price, sale_time)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [bar.id, product_id, employee_id, quantity, unit_price, total_price]
    )

    res.json({ success: true, unit_price, total_price })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to record sale' })
  }
})



  // GET BEST SELLING PRODUCTS
router.get('/:bar/best-products', async (req, res) => {
  try {
    const barId = await getBarId(req.params.bar);

    const [rows] = await db.query(`
      SELECT
        p.name AS product,
        SUM(s.quantity) AS total_sold,
        SUM(s.total_price) AS total_revenue
      FROM sales s
      JOIN products p ON p.id = s.product_id
      WHERE s.bar_id = ?
      GROUP BY p.id
      ORDER BY total_sold DESC
      LIMIT 10
    `, [barId]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:bar/stock', async (req, res) => {
  try {
    const barId = await getBarId(req.params.bar)

    const [rows] = await db.query(`
      SELECT
        p.name AS product,
        bs.units_available,
        p.buying_price
      FROM bar_stock bs
      JOIN products p ON p.id = bs.product_id
      WHERE bs.bar_id = ?
    `, [barId])

    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:bar/sales', async (req, res) => {
  try {
    const barId = await getBarId(req.params.bar)

    const [rows] = await db.query(`
      SELECT
        e.name AS employee,
        p.name AS product,
        s.quantity,
        p.selling_price AS unit_price,
        s.total_price AS amount,
        s.sale_time
      FROM sales s
      JOIN employees e ON e.id = s.employee_id
      JOIN products p ON p.id = s.product_id
      WHERE s.bar_id = ?
      ORDER BY s.sale_time DESC
    `, [barId])

    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:bar/employee-ranking', async (req, res) => {
  try {
    const { month, year } = req.query
    const barId = await getBarId(req.params.bar)

    let sql = `
      SELECT
        e.name,
        SUM(s.total_price) AS total_sales
      FROM sales s
             JOIN employees e ON e.id = s.employee_id
      WHERE s.bar_id = ?
    `

    const params = [barId]

    if (month) {
      sql += ` AND MONTH(s.sale_time) = ?`
      params.push(Number(month))
    }

    if (year) {
      sql += ` AND YEAR(s.sale_time) = ?`
      params.push(Number(year))
    }

    sql += `
      GROUP BY e.id
      ORDER BY total_sales DESC
    `

    const [rows] = await db.query(sql, params)

    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

router.get('/:bar/shifts', async (req, res) => {
  try {
    const barId = await getBarId(req.params.bar)

    const [rows] = await db.query(`
      SELECT
        s.id,
        e.name AS employee,
        s.start_time,
        s.end_time,
        s.opening_cash,
        s.closing_cash,
        s.expected_cash,
        s.variance
      FROM shifts s
      JOIN employees e ON e.id = s.employee_id
      WHERE s.bar_id = ?
      ORDER BY s.start_time DESC
    `, [barId])

    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/:bar/handover', async (req, res) => {
  try {
    const barId = await getBarId(req.params.bar)
    const { shift_id } = req.body

    await db.query(`
      UPDATE shifts
      SET end_time = NOW()
      WHERE id = ? AND bar_id = ?
    `, [shift_id, barId])

    res.json({ message: 'Cash handed over successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:bar/expenses', async (req, res) => {
  try {
    const barId = await getBarId(req.params.bar)

    const [rows] = await db.query(
      `SELECT * FROM expenses WHERE bar_id = ? ORDER BY expense_date DESC`,
      [barId]
    )

    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/:bar/expenses', async (req, res) => {
  try {
    const barId = await getBarId(req.params.bar)
    const { category, amount, expense_date } = req.body

    await db.query(
      `INSERT INTO expenses (bar_id, category, amount, expense_date)
       VALUES (?, ?, ?, ?)`,
      [barId, category, amount, expense_date]
    )

    res.json({ message: 'Expense recorded' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})
// Helper: convert JS Date to MySQL DATETIME string
function toMySQLDate(d) {
  const pad = (n) => n.toString().padStart(2, '0')
  return (
    d.getFullYear() +
    '-' + pad(d.getMonth() + 1) +
    '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) +
    ':' + pad(d.getMinutes()) +
    ':' + pad(d.getSeconds())
  )
}

// GET /api/products/performance?range=daily|weekly|monthly
export async function getProductPerformance(req, res) {
  try {
    const range = req.query.range || 'monthly'
    const now = new Date()
    let startCurrent, endCurrent, startPrev, endPrev

    if (range === 'daily') {
      const today = new Date(now)
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)

      startCurrent = toMySQLDate(new Date(today.setHours(0,0,0,0)))
      endCurrent = toMySQLDate(new Date(today.setHours(23,59,59,999)))

      startPrev = toMySQLDate(new Date(yesterday.setHours(0,0,0,0)))
      endPrev = toMySQLDate(new Date(yesterday.setHours(23,59,59,999)))

    } else if (range === 'weekly') {
      const firstDayOfWeek = new Date(now)
      firstDayOfWeek.setDate(firstDayOfWeek.getDate() - firstDayOfWeek.getDay())
      startCurrent = toMySQLDate(new Date(firstDayOfWeek.setHours(0,0,0,0)))
      endCurrent = toMySQLDate(now)

      const lastWeekStart = new Date(firstDayOfWeek)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)
      const lastWeekEnd = new Date(lastWeekStart)
      lastWeekEnd.setDate(lastWeekEnd.getDate() + 6)

      startPrev = toMySQLDate(new Date(lastWeekStart.setHours(0,0,0,0)))
      endPrev = toMySQLDate(new Date(lastWeekEnd.setHours(23,59,59,999)))

    } else { // monthly
      const startCurr = new Date(now.getFullYear(), now.getMonth(), 1)
      const endCurr = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59)

      const startPrevMonth = new Date(now.getFullYear(), now.getMonth() -1, 1)
      const endPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59)

      startCurrent = toMySQLDate(startCurr)
      endCurrent = toMySQLDate(endCurr)
      startPrev = toMySQLDate(startPrevMonth)
      endPrev = toMySQLDate(endPrevMonth)
    }

    // CURRENT PERIOD SALES
    const [currentRows] = await db.query(
      `SELECT p.name AS product,
              SUM(s.quantity) AS current_sold,
              SUM(s.total_price) AS current_revenue
       FROM sales s
       JOIN products p ON s.product_id = p.id
       WHERE s.sale_time BETWEEN ? AND ?
       GROUP BY s.product_id`,
      [startCurrent, endCurrent]
    )

    // PREVIOUS PERIOD SALES
    const [prevRows] = await db.query(
      `SELECT p.name AS product,
              SUM(s.quantity) AS previous_sold,
              SUM(s.total_price) AS previous_revenue
       FROM sales s
       JOIN products p ON s.product_id = p.id
       WHERE s.sale_time BETWEEN ? AND ?
       GROUP BY s.product_id`,
      [startPrev, endPrev]
    )

    // MERGE CURRENT + PREVIOUS
    const result = (currentRows || []).map(curr => {
      const prev = (prevRows || []).find(p => p.product === curr.product) || {}
      return {
        product: curr.product,
        current_sold: Number(curr.current_sold || 0),
        previous_sold: Number(prev.previous_sold || 0),
        current_revenue: Number(curr.current_revenue || 0),
        previous_revenue: Number(prev.previous_revenue || 0),
      }
    })

    res.json(result)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}

export default router;
