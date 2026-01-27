import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- MySQL connection ---
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Tiger1234567@',
  database: 'bars', // replace with your DB name
};

// --- API: Get Warehouse Stock ---
app.get('/api/warehouse-stock', async (req, res) => {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(`
      SELECT
        p.name AS product,
        ws.cases_available,
        p.buying_price
      FROM warehouse_stock ws
      JOIN products p ON ws.product_id = p.id
      ORDER BY p.name
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching warehouse stock:', error);
    res.status(500).json({ error: 'Failed to fetch warehouse stock' });
  } finally {
    if (connection) await connection.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
