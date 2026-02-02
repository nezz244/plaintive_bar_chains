import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dashboardRoutes from './routes/dashboard.routes.js';
import barRoutes from './routes/bars.routes.mjs';
import { getProductPerformance } from './routes/bars.routes.mjs' // path to your endpoint file
import salesRouter from './routes/bars.routes.mjs'
import barsRoutes from './routes/bars.routes.mjs'


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/bars', barRoutes);
app.use('/api', dashboardRoutes);
app.use(salesRouter);
app.use('/api', barsRoutes); // ✅ All routes in bars.routes.mjs are now prefixed with /api
app.use('/api/sales', barRoutes);

// --- MySQL pool connection ---
export const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Tiger1234567@',
  database: 'bar2.0',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.get('/api/products/performance', getProductPerformance)
// --- GET /api/bars-sales ---
app.get('/api/bars-sales', async (req, res) => {
  try {
    const [bars] = await db.query(`SELECT id, name FROM bars`);

    const results = [];

    for (let bar of bars) {
      // Total quantity & revenue today
      const [todayData] = await db.query(
        `SELECT
           SUM(quantity) AS total_quantity,
           SUM(total_price) AS total_revenue
         FROM sales
         WHERE bar_id = ? AND DATE(sale_time) = CURRENT_DATE()`,
        [bar.id]
      );

      // Total quantity & revenue yesterday
      const [yesterdayData] = await db.query(
        `SELECT
           SUM(quantity) AS total_quantity,
           SUM(total_price) AS total_revenue
         FROM sales
         WHERE bar_id = ? AND DATE(sale_time) = CURRENT_DATE() - INTERVAL 1 DAY`,
        [bar.id]
      );

      const todayRevenue = todayData[0].total_revenue || 0;
      const yesterdayRevenue = yesterdayData[0].total_revenue || 0;

      const growth =
        yesterdayRevenue === 0
          ? 0
          : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;

      results.push({
        id: bar.id,
        name: bar.name,
        total_quantity: todayData[0].total_quantity || 0,
        total_revenue: todayRevenue,
        growth: parseFloat(growth.toFixed(2)),
      });
    }

    res.json(results);
  } catch (err) {
    console.error('Failed to fetch bars:', err);
    res.status(500).json({ error: 'Failed to fetch bars' });
  }
});


// --- GET /api/bars-sales/:barId ---
app.get('/api/bars-sales/:barId', async (req, res) => {
  const barId = req.params.barId;
  try {
    const [sales] = await db.query(
      `SELECT s.id, s.product_id, s.employee_id, s.shift_id, s.quantity, s.total_price, s.sale_time
       FROM sales s
       WHERE s.bar_id = ?
       ORDER BY s.sale_time DESC`,
      [barId]
    );
    res.json(sales);
  } catch (err) {
    console.error('Failed to fetch bar sales:', err);
    res.status(500).json({ error: 'Failed to fetch bar sales' });
  }
});
// --- API: Get Warehouse Stock ---
app.get('/api/warehouse-stock', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        p.name AS product,
        ws.cases_available,
        p.units_per_case,
        p.buying_price
      FROM warehouse_stock ws
      JOIN products p ON ws.product_id = p.id
      ORDER BY p.name
    `)

    res.json(rows)
  } catch (error) {
    console.error('Error fetching warehouse stock:', error)
    res.status(500).json({ error: 'Failed to fetch warehouse stock' })
  }
})



app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
