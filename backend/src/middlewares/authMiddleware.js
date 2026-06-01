'use strict';

const jwt    = require('jsonwebtoken');
const logger = require('../utils/logger');

// ─────────────────────────────────────────
// requireAdmin
//
// Express middleware — attach to any route that
// should only be accessible to the admin.
//
// Usage in router:
//   const { requireAdmin } = require('../middleware/authMiddleware');
//   router.post('/companies', requireAdmin, uploadLogo, handleUploadError, companiesController.create);
// ─────────────────────────────────────────

function requireAdmin(req, res, next) {
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
        logger.error('🔥 JWT_SECRET is not set — cannot verify tokens');
        return res.status(500).json({ success: false, error: 'Server misconfiguration' });
    }

    // Accept token from Authorization header: "Bearer <token>"
    const authHeader = req.headers['authorization'];
    const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.admin     = payload; // { sub, role, iat, exp }
        next();
    } catch (err) {
        const reason = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
        logger.warn(`[Auth] Token rejected — ${reason} ip=${req.ip}`);
        return res.status(401).json({ success: false, error: reason });
    }
}

module.exports = { requireAdmin };