const http    = require('http');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
require('dotenv').config();

const logger          = require('./src/utils/logger');
const { verifyConnection, closeConnection } = require('./src/config/database');
const { connect: connectRedis, disconnect: disconnectRedis } = require('./src/config/redis');
const { verifyConnection: verifyR2 }  = require('./src/config/s3');
const socketService   = require('./src/services/socketService');
const { startGPSFetchCycle, stopGPSFetchCycle } = require('./src/services/gpsService');
const auth = require('./src/routes/auth');
const companiesRouter = require('./src/routes/companies');
const busesRouter     = require('./src/routes/buses');

// ─────────────────────────────────────────
// APP + HTTP SERVER
// ─────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

const PORT     = parseInt(process.env.PORT || '5000');
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─────────────────────────────────────────
// SECURITY MIDDLEWARE
// ─────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
    origin: function (origin, callback) {
        const allowed = (process.env.ALLOWED_ORIGINS || '')
            .split(',')
            .map(o => o.trim())
            .filter(Boolean);

        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        if (allowed.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS blocked: ${origin}`));
        }
    },
    credentials: true,
}));

// ─────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────
const readLimiter = rateLimit({
    windowMs: 60 * 1000,
    max:      120,
    message:  { success: false, error: 'Too many requests, please slow down' },
    standardHeaders: true,
    legacyHeaders:   false,
});

const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max:      30,
    message:  { success: false, error: 'Too many requests, please slow down' },
    standardHeaders: true,
    legacyHeaders:   false,
});

// ─────────────────────────────────────────
// GENERAL MIDDLEWARE
// ─────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev', { stream: logger.stream }));

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.status(200).json({
        status:    'ok',
        env:       NODE_ENV,
        timestamp: new Date().toISOString(),
        uptime:    process.uptime(),
    });
});

// ─────────────────────────────────────────
// SOCKET STATS
// ─────────────────────────────────────────
app.get('/api/socket/stats', (_req, res) => {
    res.status(200).json({ success: true, data: socketService.getStats() });
});

// ─────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────
app.use('/api/companies', readLimiter,  companiesRouter);
app.use('/api/buses',     readLimiter,  busesRouter);
app.use('/api/companies', writeLimiter);
app.use('/api/buses',     writeLimiter);
app.use('/api/auth', auth);


// ─────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});

// ─────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    logger.error('🔥 Unhandled error:', err.message);
    logger.error(err.stack);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─────────────────────────────────────────
// START SERVER — returns a Promise so bootstrap
// can await it and catch listen errors properly
// ─────────────────────────────────────────
function startServer() {
    return new Promise((resolve, reject) => {
        server.listen(PORT, () => {
            logger.info(`✅ Server running on port ${PORT} [${NODE_ENV}]`);
            resolve();
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger.error(`🔥 Port ${PORT} is already in use. Change PORT in .env`);
            } else {
                logger.error('🔥 Server error:', err.message);
            }
            reject(err);
        });
    });
}

// ─────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────
async function bootstrap() {
    try {
        logger.info('🚀 Starting BusTrack backend...');

        // 1. Database
        await verifyConnection();

        // 2. Redis
        await connectRedis();

        // 3. Cloudflare R2
        await verifyR2();

        // 4. Socket.IO
        socketService.init(server);

        // 5. HTTP server — properly awaited now
        await startServer();

        // 6. GPS polling cycle
        startGPSFetchCycle();

        logger.info('✅ BusTrack backend fully started');

    } catch (error) {
        logger.error('🔥 Bootstrap failed:', error.message || String(error));
        logger.error('🔥 Stack:', error.stack || 'no stack');
        process.exit(1);
    }
}

// ─────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────
async function shutdown(signal) {
    logger.info(`\n⚠️  ${signal} received — shutting down gracefully...`);

    stopGPSFetchCycle();

    server.close(async () => {
        logger.info('✅ HTTP server closed');
        await closeConnection();
        await disconnectRedis();
        logger.info('✅ All connections closed — process exiting');
        process.exit(0);
    });

    setTimeout(() => {
        logger.error('❌ Graceful shutdown timed out — forcing exit');
        process.exit(1);
    }, 15000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    logger.error('🔥 Uncaught exception:', error.message);
    logger.error(error.stack);
    shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
    logger.error('🔥 Unhandled rejection:', reason);
    shutdown('unhandledRejection');
});

// ─────────────────────────────────────────
// START
// ─────────────────────────────────────────
bootstrap();

module.exports = { app, server };