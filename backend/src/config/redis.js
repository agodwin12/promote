const Redis = require('ioredis');
const logger = require('../utils/logger');
require('dotenv').config();

// ─────────────────────────────────────────
// REDIS CLIENT
// Used for two things in this app.js:
//   1. Caching the latest GPS position per vehicle
//      so the map snaps to position instantly on page
//      load without waiting for the next 10s GPS tick.
//   2. Caching the company list for the dashboard so
//      50+ concurrent users don't hammer the DB.
// ─────────────────────────────────────────
const redisClient = new Redis({
    host:               process.env.REDIS_HOST     || '127.0.0.1',
    port:               parseInt(process.env.REDIS_PORT || '6379'),
    password:           process.env.REDIS_PASSWORD || undefined,
    db:                 0,

    // Reconnect strategy — exponential backoff capped at 30s.
    // This means a Redis blip never crashes the app.js; it just
    // degrades gracefully (positions load on first GPS tick instead).
    retryStrategy(times) {
        const delay = Math.min(times * 200, 30000);
        logger.warn(`⚠️ Redis reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
    },

    // Stop retrying after 20 failed attempts (Redis is genuinely down).
    maxRetriesPerRequest: 3,

    // Keeps the TCP connection alive on idle.
    keepAlive: 10000,

    // Prefix all keys so this app.js never collides with
    // other apps sharing the same Redis instance.
    keyPrefix: 'bustrack:',

    lazyConnect: true, // connect explicitly via connect() below
});

// ─────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────
redisClient.on('connect', () => {
    logger.info('✅ Redis connected successfully');
});

redisClient.on('ready', () => {
    logger.info('✅ Redis client ready');
});

redisClient.on('error', (error) => {
    // Log but don't crash — the app.js works without Redis,
    // just without the instant-load cache benefit.
    logger.error('🔥 Redis error:', error.message);
});

redisClient.on('close', () => {
    logger.warn('⚠️ Redis connection closed');
});

redisClient.on('reconnecting', () => {
    logger.warn('⚠️ Redis reconnecting...');
});

// ─────────────────────────────────────────
// KEY BUILDERS
// Centralised so a key format change is a one-line edit.
// ─────────────────────────────────────────
const Keys = {
    // Latest GPS position for a single vehicle
    vehicleLocation: (vehicleId) => `vehicle:${vehicleId}:location`,

    // Full company list (dashboard cards)
    companyList: () => `companies:list`,

    // Single company with its buses
    company: (companyId) => `company:${companyId}`,
};

// ─────────────────────────────────────────
// CACHE HELPERS
// ─────────────────────────────────────────

/**
 * Store the latest GPS position for a vehicle.
 * TTL defaults to REDIS_LOCATION_TTL env var (120s).
 */
async function setVehicleLocation(vehicleId, locationData) {
    try {
        const ttl = parseInt(process.env.REDIS_LOCATION_TTL || '120');
        const key = Keys.vehicleLocation(vehicleId);
        await redisClient.set(key, JSON.stringify(locationData), 'EX', ttl);
    } catch (error) {
        // Non-fatal — GPS service continues even if Redis is down
        logger.error(`❌ Redis setVehicleLocation error (vehicle ${vehicleId}):`, error.message);
    }
}

/**
 * Get the last known GPS position for a vehicle.
 * Returns null if not cached (caller should fall back to DB).
 */
async function getVehicleLocation(vehicleId) {
    try {
        const key  = Keys.vehicleLocation(vehicleId);
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        logger.error(`❌ Redis getVehicleLocation error (vehicle ${vehicleId}):`, error.message);
        return null;
    }
}

/**
 * Invalidate the cached position for a vehicle.
 * Called immediately after a new GPS point is saved to DB.
 */
async function invalidateVehicleLocation(vehicleId) {
    try {
        await redisClient.del(Keys.vehicleLocation(vehicleId));
    } catch (error) {
        logger.error(`❌ Redis invalidateVehicleLocation error (vehicle ${vehicleId}):`, error.message);
    }
}

/**
 * Generic cache get — returns parsed JSON or null.
 */
async function get(key) {
    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        logger.error(`❌ Redis get error (key: ${key}):`, error.message);
        return null;
    }
}

/**
 * Generic cache set with TTL in seconds.
 */
async function set(key, value, ttlSeconds = 60) {
    try {
        await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
        logger.error(`❌ Redis set error (key: ${key}):`, error.message);
    }
}

/**
 * Generic cache delete.
 */
async function del(key) {
    try {
        await redisClient.del(key);
    } catch (error) {
        logger.error(`❌ Redis del error (key: ${key}):`, error.message);
    }
}

// ─────────────────────────────────────────
// CONNECT + GRACEFUL SHUTDOWN
// ─────────────────────────────────────────
async function connect() {
    try {
        await redisClient.connect();
    } catch (error) {
        // Non-fatal on startup — app.js runs without Redis
        logger.warn('⚠️ Redis not available at startup, running without cache:', error.message);
    }
}

async function disconnect() {
    try {
        await redisClient.quit();
        logger.info('✅ Redis disconnected cleanly');
    } catch (error) {
        logger.error('❌ Error disconnecting Redis:', error.message);
    }
}

module.exports = {
    redisClient,
    Keys,
    connect,
    disconnect,
    setVehicleLocation,
    getVehicleLocation,
    invalidateVehicleLocation,
    get,
    set,
    del,
};