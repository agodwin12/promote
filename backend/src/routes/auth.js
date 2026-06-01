'use strict';

const express        = require('express');
const authController = require('../controllers/authController');
const { requireAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// ─────────────────────────────────────────
// POST /api/auth/login
// Body: { username, password }
// Returns: { token, expiresIn }
// ─────────────────────────────────────────
router.post('/login', authController.login);

// ─────────────────────────────────────────
// GET /api/auth/me
// Verify token is still valid.
// Called by the frontend on dashboard load.
// ─────────────────────────────────────────
router.get('/me', requireAdmin, authController.me);

module.exports = router;