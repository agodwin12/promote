const multer = require('multer');
const logger = require('../utils/logger');

// ─────────────────────────────────────────
// ALLOWED MIME TYPES
// ─────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ─────────────────────────────────────────
// FILE FILTER
// Rejects non-image uploads before they consume
// memory — saves bandwidth and prevents abuse.
// ─────────────────────────────────────────
function fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        logger.debug(`📎 Upload accepted: ${file.originalname} (${file.mimetype})`);
        cb(null, true);
    } else {
        logger.warn(`🚫 Upload rejected: ${file.originalname} (${file.mimetype})`);
        cb(
            new multer.MulterError(
                'LIMIT_UNEXPECTED_FILE',
                'Only JPEG, PNG, WebP, or SVG images are allowed'
            ),
            false
        );
    }
}

// ─────────────────────────────────────────
// MULTER INSTANCE
// memoryStorage — files are kept as Buffers in RAM
// and passed directly to sharp → R2.
// Nothing is ever written to disk.
// ─────────────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_FILE_SIZE,
        files:    1,
    },
    fileFilter,
});

// ─────────────────────────────────────────
// SINGLE LOGO UPLOAD
// Use this on any route that accepts one logo file
// under the field name 'logo'.
// Usage in route: router.post('/', uploadLogo, controller.create)
// ─────────────────────────────────────────
const uploadLogo = upload.single('logo');

// ─────────────────────────────────────────
// MULTER ERROR HANDLER MIDDLEWARE
// Express only catches multer errors if you wrap them.
// Attach this after any route that uses uploadLogo.
//
// Usage:
//   router.post('/', uploadLogo, handleUploadError, controller.create)
// ─────────────────────────────────────────
function handleUploadError(err, _req, res, next) {
    if (err instanceof multer.MulterError) {
        const messages = {
            LIMIT_FILE_SIZE:       `File too large — maximum ${MAX_FILE_SIZE / (1024 * 1024)}MB allowed`,
            LIMIT_FILE_COUNT:      'Only one file can be uploaded at a time',
            LIMIT_UNEXPECTED_FILE: err.field || 'Invalid file type',
        };

        const message = messages[err.code] || err.message;
        logger.warn(`⚠️ Multer error [${err.code}]: ${message}`);

        return res.status(400).json({
            success: false,
            error:   message,
        });
    }

    // Non-multer error — pass to the next error handler
    next(err);
}

module.exports = {
    uploadLogo,
    handleUploadError,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE,
};