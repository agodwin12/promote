'use strict';

const express           = require('express');
const companyController = require('../controllers/companyController');
const { uploadLogo, handleUploadError } = require('../middlewares/upload');
const { requireAdmin }  = require('../middlewares/authMiddleware');

const router = express.Router();

// ─────────────────────────────────────────
// PUBLIC — read only (used by the map)
// ─────────────────────────────────────────

// GET /api/companies
router.get('/', companyController.getAll);

// GET /api/companies/:id
router.get('/:id', companyController.getOne);

// GET /api/companies/:id/buses
router.get('/:id/buses', companyController.getBuses);

// ─────────────────────────────────────────
// PROTECTED — admin only
// ─────────────────────────────────────────

// POST /api/companies
router.post('/',
    requireAdmin,
    uploadLogo,
    handleUploadError,
    companyController.create,
);

// PUT /api/companies/:id
router.put('/:id',
    requireAdmin,
    uploadLogo,
    handleUploadError,
    companyController.update,
);

// DELETE /api/companies/:id
router.delete('/:id',
    requireAdmin,
    companyController.remove,
);

module.exports = router;