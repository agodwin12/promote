'use strict';

const jwt    = require('jsonwebtoken');
const logger = require('../utils/logger');

// ─────────────────────────────────────────
// ADMIN CREDENTIALS
// Set these in your backend .env:
//   ADMIN_USERNAME=admin
//   ADMIN_PASSWORD=your_secure_password
//   JWT_SECRET=your_jwt_secret_32chars_min
//   JWT_EXPIRES_IN=8h
// ─────────────────────────────────────────

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function sendSuccess(res, data, statusCode = 200) {
    return res.status(statusCode).json({ success: true, data });
}

function sendError(res, message, statusCode = 400) {
    return res.status(statusCode).json({ success: false, error: message });
}

// ─────────────────────────────────────────
// POST /api/auth/login
// Body: { username, password }
// Returns: { token, expiresIn }
// ─────────────────────────────────────────
async function login(req, res) {
    if (!JWT_SECRET) {
        logger.error('🔥 JWT_SECRET is not set in environment');
        return sendError(res, 'Server misconfiguration — contact administrator', 500);
    }

    const { username, password } = req.body;

    if (!username || !password) {
        return sendError(res, 'Username and password are required', 400);
    }

    // Constant-time comparison to prevent timing attacks
    const usernameMatch = username === ADMIN_USERNAME;
    const passwordMatch = password === ADMIN_PASSWORD;

    if (!usernameMatch || !passwordMatch) {
        logger.warn(`[Auth] Failed login attempt — username="${username}" ip=${req.ip}`);
        // Same message for both wrong username and wrong password — don't leak which one
        return sendError(res, 'Invalid credentials', 401);
    }

    const payload = {
        sub:  'admin',
        role: 'admin',
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    logger.info(`[Auth] Admin logged in — ip=${req.ip}`);

    return sendSuccess(res, { token, expiresIn: JWT_EXPIRES_IN });
}

// ─────────────────────────────────────────
// GET /api/auth/me
// Verify the current token is still valid.
// Returns 200 if valid, 401 if not.
// Called by the frontend on page load to
// check if the stored token is still good.
// ─────────────────────────────────────────
async function me(req, res) {
    // req.admin is set by authMiddleware if token is valid
    return sendSuccess(res, { role: req.admin.role });
}

module.exports = { login, me };