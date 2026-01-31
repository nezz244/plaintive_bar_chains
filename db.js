import mysql from 'mysql2/promise'

export const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Tiger1234567@',
  database: 'bar2.0',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})
