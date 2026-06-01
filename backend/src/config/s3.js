const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const sharp  = require('sharp');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
require('dotenv').config();

// ─────────────────────────────────────────
// R2 CLIENT
// Lazy-initialised so dotenv has already loaded
// by the time the SDK reads the credentials.
// ─────────────────────────────────────────
let _r2Client = null;

function getClient() {
    if (_r2Client) return _r2Client;

    _r2Client = new S3Client({
        region:   'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId:     process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });

    return _r2Client;
}

const BUCKET     = process.env.R2_BUCKET_NAME || 'elizflow';
const PUBLIC_URL = process.env.R2_PUBLIC_URL  || '';

// ─────────────────────────────────────────
// IMAGE CONSTRAINTS
// ─────────────────────────────────────────
const IMAGE_CONFIG = {
    maxWidth:     400,
    maxHeight:    400,
    quality:      85,
    maxSizeBytes: 5 * 1024 * 1024,
};

// ─────────────────────────────────────────
// PROCESS IMAGE — resize + convert to WebP
// ─────────────────────────────────────────
async function processImage(buffer) {
    try {
        const processed = await sharp(buffer)
            .resize(IMAGE_CONFIG.maxWidth, IMAGE_CONFIG.maxHeight, {
                fit:                'inside',
                withoutEnlargement: true,
            })
            .webp({ quality: IMAGE_CONFIG.quality })
            .toBuffer();

        logger.debug(
            `🖼️  Image processed: ${buffer.length}B → ${processed.length}B ` +
            `(${Math.round((1 - processed.length / buffer.length) * 100)}% smaller)`
        );

        return processed;
    } catch (error) {
        logger.error('🔥 Image processing error:', error.message);
        throw new Error('Failed to process image');
    }
}

// ─────────────────────────────────────────
// UPLOAD LOGO
// ─────────────────────────────────────────
async function uploadLogo(buffer, companyId) {
    if (!buffer || buffer.length === 0) throw new Error('Empty file buffer');
    if (buffer.length > IMAGE_CONFIG.maxSizeBytes) {
        throw new Error(`File too large — max ${IMAGE_CONFIG.maxSizeBytes / (1024 * 1024)}MB`);
    }

    const processedBuffer = await processImage(buffer);
    const key             = `logos/${companyId}/${uuidv4()}.webp`;

    try {
        await getClient().send(
            new PutObjectCommand({
                Bucket:       BUCKET,
                Key:          key,
                Body:         processedBuffer,
                ContentType:  'image/webp',
                CacheControl: 'public, max-age=31536000, immutable',
                Metadata: {
                    companyId:  String(companyId),
                    uploadedAt: new Date().toISOString(),
                },
            })
        );

        const url = buildPublicUrl(key);
        logger.info(`✅ Logo uploaded: ${key}`);
        return { key, url };

    } catch (error) {
        logger.error('🔥 R2 upload error:', error.message);
        throw new Error('Failed to upload logo to storage');
    }
}

// ─────────────────────────────────────────
// DELETE LOGO
// ─────────────────────────────────────────
async function deleteLogo(key) {
    if (!key) return;
    try {
        await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
        logger.info(`🗑️  Logo deleted: ${key}`);
    } catch (error) {
        logger.error(`❌ R2 delete error (${key}):`, error.message);
    }
}

// ─────────────────────────────────────────
// BUILD PUBLIC URL
// ─────────────────────────────────────────
function buildPublicUrl(key) {
    if (!PUBLIC_URL) return key;
    return `${PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}

// ─────────────────────────────────────────
// VERIFY CONNECTION ON STARTUP
// ─────────────────────────────────────────
async function verifyConnection() {
    try {
        await getClient().send(
            new HeadObjectCommand({ Bucket: BUCKET, Key: '__healthcheck__' })
        );
        logger.info('✅ Cloudflare R2 connection verified');
    } catch (error) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            logger.info('✅ Cloudflare R2 connection verified (bucket reachable)');
        } else {
            logger.warn(`⚠️ Cloudflare R2 check failed: ${error.message}`);
            logger.warn('   Logo uploads will fail until R2 credentials are correct');
        }
    }
}

module.exports = {
    uploadLogo,
    deleteLogo,
    buildPublicUrl,
    verifyConnection,
    IMAGE_CONFIG,
};