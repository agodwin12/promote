'use strict';

const express        = require('express');
const busController  = require('../controllers/busController');
const { requireAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

// ─────────────────────────────────────────
// PUBLIC — read only (used by the map)
// ─────────────────────────────────────────

// GET /api/buses
router.get('/', busController.getAll);

// GET /api/buses/:id
router.get('/:id', busController.getOne);

// GET /api/buses/:id/location
router.get('/:id/location', busController.getLocation);

// ─────────────────────────────────────────
// PROTECTED — admin only
// ─────────────────────────────────────────

// POST /api/buses
router.post('/',
    requireAdmin,
    busController.create,
);

// PUT /api/buses/:id
router.put('/:id',
    requireAdmin,
    busController.update,
);

// DELETE /api/buses/:id
router.delete('/:id',
    requireAdmin,
    busController.remove,
);

module.exports = router;