const { models }                    = require('../config/database');
const { uploadLogo, deleteLogo }    = require('../config/s3');
const { get, set, del, Keys }       = require('../config/redis');
const logger                        = require('../utils/logger');

const { Company, Bus, Location }    = models;

// ─────────────────────────────────────────
// CACHE TTLs
// ─────────────────────────────────────────
const COMPANY_LIST_TTL = 60;   // seconds
const COMPANY_TTL      = 120;  // seconds

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function slugify(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
}

function sendSuccess(res, data, statusCode = 200) {
    return res.status(statusCode).json({ success: true, data });
}

function sendError(res, message, statusCode = 500) {
    logger.error(`API error [${statusCode}]: ${message}`);
    return res.status(statusCode).json({ success: false, error: message });
}

// ─────────────────────────────────────────
// GET /api/companies
// Dashboard card list — all companies with logo + name.
// ─────────────────────────────────────────
async function getAll(req, res) {
    try {
        const cacheKey = Keys.companyList();
        const cached   = await get(cacheKey);

        if (cached) {
            logger.debug('📦 Company list served from Redis cache');
            return sendSuccess(res, cached);
        }

        const companies = await Company.findAll({
            attributes: ['id', 'name', 'slug', 'logo_url', 'created_at'],
            order:      [['name', 'ASC']],
        });

        const data = companies.map((c) => c.toJSON());
        await set(cacheKey, data, COMPANY_LIST_TTL);

        return sendSuccess(res, data);

    } catch (error) {
        logger.error('🔥 getAll companies error:', error.message);
        return sendError(res, 'Failed to fetch companies');
    }
}

// ─────────────────────────────────────────
// GET /api/companies/:id
// Single company + its buses list.
// ─────────────────────────────────────────
async function getOne(req, res) {
    const { id } = req.params;

    try {
        const cacheKey = Keys.company(id);
        const cached   = await get(cacheKey);

        if (cached) {
            logger.debug(`📦 Company ${id} served from Redis cache`);
            return sendSuccess(res, cached);
        }

        const company = await Company.findByPk(id, {
            attributes: ['id', 'name', 'slug', 'logo_url', 'created_at'],
            include: [
                {
                    model:      Bus,
                    as:         'buses',
                    attributes: ['id', 'plate', 'model', 'mac_id', 'created_at'],
                },
            ],
        });

        if (!company) {
            return sendError(res, 'Company not found', 404);
        }

        const data = company.toJSON();
        await set(cacheKey, data, COMPANY_TTL);

        return sendSuccess(res, data);

    } catch (error) {
        logger.error(`🔥 getOne company ${id} error:`, error.message);
        return sendError(res, 'Failed to fetch company');
    }
}

// ─────────────────────────────────────────
// POST /api/companies
// Create a new company with logo upload to R2.
// ─────────────────────────────────────────
async function create(req, res) {
    const { name, slug } = req.body;

    if (!name || !name.trim()) {
        return sendError(res, 'Company name is required', 400);
    }

    if (!req.file) {
        return sendError(res, 'Company logo is required', 400);
    }

    try {
        const finalSlug = slug?.trim() || slugify(name);

        // Duplicate check
        const existing = await Company.findOne({
            where: {
                [require('sequelize').Op.or]: [
                    { name: name.trim() },
                    { slug: finalSlug },
                ],
            },
        });

        if (existing) {
            return sendError(res, 'A company with this name or slug already exists', 409);
        }

        // Upload logo to R2 — use a temp key before we have the real DB id
        const tempId          = `temp-${Date.now()}`;
        const { key, url }    = await uploadLogo(req.file.buffer, tempId);

        let company;
        try {
            company = await Company.create({
                name:     name.trim(),
                slug:     finalSlug,
                logo_url: url,
                logo_key: key,
            });
        } catch (dbError) {
            // DB insert failed — delete the orphaned R2 object
            await deleteLogo(key);
            throw dbError;
        }

        // Bust the company list cache
        await del(Keys.companyList());

        logger.info(`✅ Company created: id=${company.id}, name=${company.name}`);

        return sendSuccess(
            res,
            {
                id:         company.id,
                name:       company.name,
                slug:       company.slug,
                logo_url:   company.logo_url,
                created_at: company.created_at,
            },
            201
        );

    } catch (error) {
        logger.error('🔥 create company error:', error.message);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return sendError(res, 'A company with this name or slug already exists', 409);
        }
        return sendError(res, 'Failed to create company');
    }
}

// ─────────────────────────────────────────
// PUT /api/companies/:id
// Update name / slug and optionally replace logo.
// ─────────────────────────────────────────
async function update(req, res) {
    const { id }         = req.params;
    const { name, slug } = req.body;

    try {
        const company = await Company.findByPk(id);

        if (!company) {
            return sendError(res, 'Company not found', 404);
        }

        let logoUrl = company.logo_url;
        let logoKey = company.logo_key;

        // Replace logo only if a new file was sent
        if (req.file) {
            const uploaded = await uploadLogo(req.file.buffer, id);

            // Delete the old R2 object after successful upload
            if (company.logo_key) {
                await deleteLogo(company.logo_key);
            }

            logoUrl = uploaded.url;
            logoKey = uploaded.key;
        }

        const updatedName = name?.trim() || company.name;
        const updatedSlug = slug?.trim() || slugify(updatedName);

        await company.update({
            name:     updatedName,
            slug:     updatedSlug,
            logo_url: logoUrl,
            logo_key: logoKey,
        });

        // Bust both caches
        await del(Keys.companyList());
        await del(Keys.company(id));

        logger.info(`✅ Company updated: id=${id}`);

        return sendSuccess(res, {
            id:         company.id,
            name:       company.name,
            slug:       company.slug,
            logo_url:   company.logo_url,
            created_at: company.created_at,
        });

    } catch (error) {
        logger.error(`🔥 update company ${id} error:`, error.message);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return sendError(res, 'A company with this name or slug already exists', 409);
        }
        return sendError(res, 'Failed to update company');
    }
}

// ─────────────────────────────────────────
// DELETE /api/companies/:id
// Delete company + all buses + all location history.
// ─────────────────────────────────────────
async function remove(req, res) {
    const { id } = req.params;

    try {
        const company = await Company.findByPk(id);

        if (!company) {
            return sendError(res, 'Company not found', 404);
        }

        const logoKey = company.logo_key;

        // Sequelize cascades handle buses + locations via associations
        await company.destroy();

        // Delete logo from R2
        if (logoKey) {
            await deleteLogo(logoKey);
        }

        // Bust caches
        await del(Keys.companyList());
        await del(Keys.company(id));

        logger.info(`✅ Company deleted: id=${id}, name=${company.name}`);

        return sendSuccess(res, {
            message: `Company "${company.name}" deleted successfully`,
        });

    } catch (error) {
        logger.error(`🔥 remove company ${id} error:`, error.message);
        return sendError(res, 'Failed to delete company');
    }
}

// ─────────────────────────────────────────
// GET /api/companies/:id/buses
// All buses for a company with their latest
// GPS position — seeds the map on page load
// before Socket.IO updates start arriving.
// ─────────────────────────────────────────
async function getBuses(req, res) {
    const { id } = req.params;

    try {
        const company = await Company.findByPk(id, {
            attributes: ['id', 'name'],
        });

        if (!company) {
            return sendError(res, 'Company not found', 404);
        }

        const buses = await Bus.findAll({
            where:      { company_id: id },
            attributes: ['id', 'plate', 'model', 'mac_id'],
            include: [
                {
                    model:      Location,
                    as:         'locations',
                    attributes: [
                        'latitude', 'longitude', 'speed',
                        'direction', 'status', 'gps_quality', 'sys_time',
                    ],
                    // Latest location only
                    order:  [['sys_time', 'DESC']],
                    limit:  1,
                    separate: true,  // runs as a separate query to respect limit per bus
                },
            ],
        });

        const data = buses.map((bus) => {
            const b        = bus.toJSON();
            const raw      = b.locations?.[0] || null;
            const location = raw ? {
                ...raw,
                latitude:  parseFloat(raw.latitude),
                longitude: parseFloat(raw.longitude),
                speed:     parseFloat(raw.speed ?? 0),
            } : null;
            return {
                id:       b.id,
                plate:    b.plate,
                model:    b.model,
                mac_id:   b.mac_id,
                location,
            };
        });

        return sendSuccess(res, data);

    } catch (error) {
        logger.error(`🔥 getBuses for company ${id} error:`, error.message);
        return sendError(res, 'Failed to fetch buses');
    }
}

module.exports = {
    getAll,
    getOne,
    create,
    update,
    remove,
    getBuses,
};