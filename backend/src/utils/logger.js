const { createLogger, format, transports } = require('winston');
const path = require('path');
require('dotenv').config();

const { combine, timestamp, errors, json, colorize, printf } = format;

const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_DIR  = path.join(process.cwd(), 'logs');

// ─────────────────────────────────────────
// CUSTOM FORMAT — human-readable for dev console
// ─────────────────────────────────────────
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}] ${stack || message}${metaStr}`;
});

// ─────────────────────────────────────────
// TRANSPORT LIST
// In production: write JSON to rotating log files + console.
// In development: pretty-print to console only.
// ─────────────────────────────────────────
const buildTransports = () => {
    const list = [];

    if (NODE_ENV === 'production') {
        // Combined log — all levels
        list.push(
            new transports.File({
                filename:  path.join(LOG_DIR, 'combined.log'),
                maxsize:   10 * 1024 * 1024, // 10 MB
                maxFiles:  5,
                tailable:  true,
            })
        );

        // Error log — errors only, easier to grep in production
        list.push(
            new transports.File({
                filename:  path.join(LOG_DIR, 'error.log'),
                level:     'error',
                maxsize:   10 * 1024 * 1024,
                maxFiles:  5,
                tailable:  true,
            })
        );

        // GPS-specific log — debug level, high volume
        list.push(
            new transports.File({
                filename:  path.join(LOG_DIR, 'gps.log'),
                level:     'debug',
                maxsize:   20 * 1024 * 1024, // 20 MB — GPS logs are chatty
                maxFiles:  3,
                tailable:  true,
            })
        );
    }

    // Console transport — always on
    list.push(
        new transports.Console({
            format: NODE_ENV === 'production'
                ? combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json())
                : combine(
                    colorize({ all: true }),
                    timestamp({ format: 'HH:mm:ss' }),
                    errors({ stack: true }),
                    devFormat
                ),
        })
    );

    return list;
};

// ─────────────────────────────────────────
// LOGGER INSTANCE
// ─────────────────────────────────────────
const logger = createLogger({
    // In production log everything from info up.
    // In development log everything including debug (GPS traces).
    level: NODE_ENV === 'production' ? 'info' : 'debug',

    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        json()
    ),

    transports: buildTransports(),

    // Don't crash the process on uncaught logger errors
    exitOnError: false,
});

// ─────────────────────────────────────────
// STREAM — for Morgan HTTP request logging
// Pipes Morgan output into Winston so all logs
// end up in the same files / format.
// ─────────────────────────────────────────
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};

module.exports = logger;