import express from 'express';
import { db } from '../server.js';

const router = express.Router();

/* ===========================
   BAR OVERVIEW
=========================== */
router.get('/overview', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        b.id AS bar_id,
        b.name AS bar_name,
        SUM(CASE
          WHEN MONTH(s.sale_time) = MONTH(CURRENT_DATE())
           AND YEAR(s.sale_time) = YEAR(CURRENT_DATE())
          THEN s.total_price ELSE 0 END
        ) AS current_month,
        SUM(CASE
          WHEN MONTH(s.sale_time) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH)
           AND YEAR(s.sale_time) = YEAR(CURRENT_DATE() - INTERVAL 1 MONTH)
          THEN s.total_price ELSE 0 END
        ) AS last_month
      FROM bars b
      LEFT JOIN sales s ON s.bar_id = b.id
      GROUP BY b.id, b.name
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching overview:', error);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

/* ===========================
   DAILY SALES
=========================== */
router.get('/daily-sales', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        DATE(sale_time) AS day,
        SUM(total_price) AS total
      FROM sales
      WHERE MONTH(sale_time) = MONTH(CURRENT_DATE())
        AND YEAR(sale_time) = YEAR(CURRENT_DATE())
      GROUP BY DATE(sale_time)
      ORDER BY day
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching daily sales:', error);
    res.status(500).json({ error: 'Failed to fetch daily sales' });
  }
});

/* ===========================
   EMPLOYEE PERFORMANCE
=========================== */
router.get('/employees', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        e.name,
        e.id,
        SUM(s.total_price) AS revenue
      FROM sales s
      JOIN employees e ON e.id = s.employee_id
      WHERE MONTH(s.sale_time) = MONTH(CURRENT_DATE())
      GROUP BY e.id
      ORDER BY revenue DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

/* ===========================
   SHIFT REVENUE
=========================== */
router.get('/shifts', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        e.name AS employee_name,
        SUM(s.total_price) AS revenue
      FROM sales s
      JOIN shifts sh ON sh.id = s.shift_id
      JOIN employees e ON e.id = sh.employee_id
      WHERE MONTH(s.sale_time) = MONTH(CURRENT_DATE())
      GROUP BY e.id
      ORDER BY revenue DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching shift revenue:', error);
    res.status(500).json({ error: 'Failed to fetch shift revenue' });
  }
});

/* ===========================
   PRODUCT PROFITABILITY
=========================== */
router.get('/products', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        p.id,
        p.name,
        SUM(s.quantity) AS units_sold,
        SUM((p.selling_price - p.buying_price) * s.quantity) AS profit
      FROM sales s
      JOIN products p ON p.id = s.product_id
      GROUP BY p.id, p.name
      ORDER BY profit DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Add stock to warehouse
router.post('/warehouse/add', async (req, res) => {
  try {
    const { product_id, cases_to_add, employee_id, notes } = req.body

    if (!product_id || !cases_to_add) {
      return res.status(400).json({ error: 'product_id and cases_to_add are required' })
    }

    // Check if product exists in warehouse_stock
    const [[existingStock]] = await db.query(
      'SELECT cases_available FROM warehouse_stock WHERE product_id = ?',
      [product_id]
    )

    if (existingStock) {
      // Update existing stock
      await db.query(
        'UPDATE warehouse_stock SET cases_available = cases_available + ? WHERE product_id = ?',
        [cases_to_add, product_id]
      )
    } else {
      // Insert new stock record
      await db.query(
        'INSERT INTO warehouse_stock (product_id, cases_available) VALUES (?, ?)',
        [product_id, cases_to_add]
      )
    }

    // Optional: log the addition to a reconciliation table
    if (employee_id) {
      await db.query(
        `INSERT INTO warehouse_reconciliation
         (product_id, system_cases, physical_cases, variance, reconciled_by, notes)
         VALUES (?, 0, ?, ?, ?, ?)`,
        [product_id, cases_to_add, cases_to_add, employee_id, notes || 'Added stock']
      )
    }

    res.json({ message: 'Stock added successfully', product_id, cases_added: cases_to_add })
  } catch (error) {
    console.error('Error adding warehouse stock:', error)
    res.status(500).json({ error: 'Failed to add warehouse stock' })
  }
})

router.get('/bars', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        b.name,
        b.id,
        SUM(s.total_price) AS revenue
      FROM sales s
      JOIN bars b ON b.id = s.bar_id
      GROUP BY b.id
      ORDER BY revenue DESC
    `)

    res.json(rows)
  } catch (error) {
    console.error('Error fetching bars:', error)
    res.status(500).json({ error: 'Failed to fetch bars' })
  }
})

// POST /warehouse/reconcile
router.post('/reconcile', async (req, res) => {
  const { product_id, physical_cases, employee_id, notes } = req.body

  const [[stock]] = await db.query(`
    SELECT cases_available FROM warehouse_stock WHERE product_id = ?
  `, [product_id])

  const variance = physical_cases - stock.cases_available

  await db.query(`
    INSERT INTO warehouse_reconciliation
    (product_id, system_cases, physical_cases, variance, reconciled_by, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    product_id,
    stock.cases_available,
    physical_cases,
    variance,
    employee_id,
    notes
  ])

  // Adjust warehouse stock to physical count
  await db.query(`
    UPDATE warehouse_stock
    SET cases_available = ?
    WHERE product_id = ?
  `, [physical_cases, product_id])

  res.json({ message: 'Warehouse reconciled' })
})
// POST /bars/transfer
router.post('/bars/transfer', async (req, res) => {
  const {
    product_id,
    from_bar_id,
    to_bar_id,
    cases,
    employee_id
  } = req.body

  // Check source bar stock
  const [[stock]] = await db.query(`
    SELECT units_available FROM bar_stock
    WHERE bar_id = ? AND product_id = ?
  `, [from_bar_id, product_id])

  if (!stock || stock.units_available < cases) {
    return res.status(400).json({ message: 'Insufficient stock' })
  }

  // Deduct from source bar
  await db.query(`
    UPDATE bar_stock
    SET units_available = units_available - ?
    WHERE bar_id = ? AND product_id = ?
  `, [cases, from_bar_id, product_id])

  // Add to destination bar
  await db.query(`
    INSERT INTO bar_stock (bar_id, product_id, units_available)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE units_available = units_available + ?
  `, [to_bar_id, product_id, cases, cases])

  // Log transfer
  await db.query(`
    INSERT INTO bar_transfers
    (product_id, from_bar_id, to_bar_id, cases, initiated_by)
    VALUES (?, ?, ?, ?, ?)
  `, [product_id, from_bar_id, to_bar_id, cases, employee_id])

  res.json({ message: 'Transfer completed' })
})


// Endpoint to distribute product
// Distribute warehouse stock to a bar
router.post('/warehouse/distribute', async (req, res) => {
  try {
    const { product_id, bar_id, cases_to_send, employee_id, notes } = req.body;

    // Validate input
    if (!product_id || !bar_id || !cases_to_send || cases_to_send <= 0) {
      return res.status(400).json({ error: 'product_id, bar_id, and a positive cases_to_send are required' });
    }

    // Check current warehouse stock
    const [[warehouseStock]] = await db.query(
      'SELECT cases_available FROM warehouse_stock WHERE product_id = ?',
      [product_id]
    );

    if (!warehouseStock || warehouseStock.cases_available < cases_to_send) {
      return res.status(400).json({ error: 'Insufficient warehouse stock' });
    }

    // Deduct from warehouse
    await db.query(
      'UPDATE warehouse_stock SET cases_available = cases_available - ? WHERE product_id = ?',
      [cases_to_send, product_id]
    );

    // Add to bar_stock
    await db.query(
      `INSERT INTO bar_stock (bar_id, product_id, units_available)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE units_available = units_available + ?`,
      [bar_id, product_id, cases_to_send, cases_to_send]
    );

    // Optional: log distribution in a reconciliation table
    if (employee_id) {
      await db.query(
        `INSERT INTO warehouse_reconciliation
         (product_id, system_cases, physical_cases, variance, reconciled_by, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          product_id,
          warehouseStock.cases_available,
          warehouseStock.cases_available - cases_to_send,
          -cases_to_send,
          employee_id,
          notes || `Distributed ${cases_to_send} cases to bar ${bar_id}`
        ]
      );
    }

    res.json({ message: 'Stock successfully distributed', product_id, bar_id, cases_sent: cases_to_send });
  } catch (error) {
    console.error('Error distributing warehouse stock:', error);
    res.status(500).json({ error: 'Failed to distribute stock' });
  }
});


export default router;
