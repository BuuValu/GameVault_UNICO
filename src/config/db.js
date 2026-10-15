const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gamevault',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Los repositorios consultan exclusivamente nombres de tablas y columnas en inglés.
// La API HTTP conserva claves/valores en español sin alterar la persistencia.
const { adaptarResultado } = require('./adaptador-respuestas');
module.exports = {
    execute: async (...args) => adaptarResultado(await pool.execute(...args)),
    query: async (...args) => adaptarResultado(await pool.query(...args)),
    getConnection: (...args) => pool.getConnection(...args),
    end: (...args) => pool.end(...args)
};