const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
require('dotenv').config();

// ─────────────────────────────────────────
// CONNECTION POOL
// A pool is used instead of a single connection so that
// 50+ companies with concurrent GPS updates never block
// each other waiting for a free DB handle.
// ─────────────────────────────────────────
const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT || '3306'),
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'bustrack',
    waitForConnections: true,
    connectionLimit:    parseInt(process.env.DB_POOL_MAX || '20'),
    queueLimit:         0,           // unlimited queue — never reject a waiting request
    enableKeepAlive:    true,
    keepAliveInitialDelay: 10000,    // 10s — prevents silent TCP drops on idle connections

    // Allow '0000-00-00 00:00:00' timestamps coming from the GPS provider
    typeCast(field, next) {
        if (field.type === 'DATETIME' || field.type === 'TIMESTAMP') {
            const val = field.string();
            if (!val || val.startsWith('0000')) return null;
            return new Date(val);
        }
        return next();
    },
});

// ─────────────────────────────────────────
// VERIFY CONNECTION ON STARTUP
// Fails fast so the process exits immediately if the DB
// is misconfigured rather than silently crashing later.
// ─────────────────────────────────────────
async function verifyConnection() {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("SET SESSION sql_mode='ALLOW_INVALID_DATES'");
        await conn.ping();
        logger.info('✅ MySQL pool connected successfully');
    } catch (error) {
        logger.error('🔥 MySQL connection failed:', error.message);
        process.exit(1);
    } finally {
        if (conn) conn.release();
    }
}

// ─────────────────────────────────────────
// QUERY HELPER
// Wraps pool.execute with structured error logging.
// All services use this instead of calling pool directly.
// ─────────────────────────────────────────
async function query(sql, params = []) {
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (error) {
        logger.error('🔥 DB query error:', { sql, error: error.message });
        throw error;
    }
}

// ─────────────────────────────────────────
// TRANSACTION HELPER
// Wraps a callback in BEGIN / COMMIT / ROLLBACK.
// Usage:
//   await transaction(async (conn) => {
//     await conn.execute('INSERT INTO ...', [...]);
//     await conn.execute('UPDATE ...', [...]);
//   });
// ─────────────────────────────────────────
async function transaction(callback) {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
        const result = await callback(conn);
        await conn.commit();
        return result;
    } catch (error) {
        await conn.rollback();
        logger.error('🔥 DB transaction rolled back:', error.message);
        throw error;
    } finally {
        conn.release();
    }
}

// ─────────────────────────────────────────
// GRACEFUL SHUTDOWN
// Called by app.js on SIGTERM / SIGINT so the pool
// drains cleanly without cutting active queries.
// ─────────────────────────────────────────
async function closePool() {
    try {
        await pool.end();
        logger.info('✅ MySQL pool closed');
    } catch (error) {
        logger.error('❌ Error closing MySQL pool:', error.message);
    }
}

module.exports = {
    pool,
    query,
    transaction,
    verifyConnection,
    closePool,
};