const { models } = require('../config/database');
const logger      = require('../utils/logger');

const { BusStop, Company } = models;

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function sendSuccess(res, data, statusCode = 200) {
    return res.status(statusCode).json({ success: true, data });
}

function sendError(res, message, statusCode = 500) {
    logger.error(`[BusStop] API error [${statusCode}]: ${message}`);
    return res.status(statusCode).json({ success: false, error: message });
}

function parseCoord(value, name) {
    const n = parseFloat(value);
    if (isNaN(n)) throw new Error(`Invalid ${name}: must be a number`);
    return n;
}

// ─────────────────────────────────────────
// GET /api/bus-stops?companyId=:id
// Returns all stops for a given company.
// Used by the map to render stop markers.
// ─────────────────────────────────────────

async function listByCompany(req, res) {
    try {
        const { companyId } = req.query;

        if (!companyId) {
            return sendError(res, 'companyId query parameter is required', 400);
        }

        const id = parseInt(companyId, 10);
        if (isNaN(id) || id <= 0) {
            return sendError(res, 'companyId must be a positive integer', 400);
        }

        const stops = await BusStop.findAll({
            where:   { company_id: id },
            order:   [['name', 'ASC']],
            attributes: ['id', 'company_id', 'name', 'latitude', 'longitude', 'created_at'],
            raw:     true,
        });

        // Coerce DECIMAL strings → numbers for the frontend
        const normalised = stops.map((s) => ({
            id:         s.id,
            company_id: s.company_id,
            name:       s.name,
            latitude:   parseFloat(s.latitude),
            longitude:  parseFloat(s.longitude),
            created_at: s.created_at,
        }));

        return sendSuccess(res, normalised);

    } catch (err) {
        logger.error(`[BusStop] listByCompany error: ${err.message}`);
        return sendError(res, 'Failed to fetch bus stops');
    }
}

// ─────────────────────────────────────────
// GET /api/bus-stops/all
// Returns every stop across all companies.
// Used by the admin panel overview table.
// ─────────────────────────────────────────

async function listAll(req, res) {
    try {
        const stops = await BusStop.findAll({
            order: [
                ['company_id', 'ASC'],
                ['name',       'ASC'],
            ],
            include: [{
                model:      Company,
                as:         'company',
                attributes: ['id', 'name'],
            }],
        });

        const normalised = stops.map((s) => ({
            id:           s.id,
            company_id:   s.company_id,
            company_name: s.company?.name ?? '—',
            name:         s.name,
            latitude:     parseFloat(s.latitude),
            longitude:    parseFloat(s.longitude),
            created_at:   s.created_at,
        }));

        return sendSuccess(res, normalised);

    } catch (err) {
        logger.error(`[BusStop] listAll error: ${err.message}`);
        return sendError(res, 'Failed to fetch bus stops');
    }
}

// ─────────────────────────────────────────
// POST /api/bus-stops
// Creates a new bus stop.
// Admin-only — protected by ADMIN_SECRET header.
//
// Body: { company_id, name, latitude, longitude }
// ─────────────────────────────────────────

async function create(req, res) {
    try {
        const { company_id, name, latitude, longitude } = req.body;

        // ── Validate required fields ──────────────────────────────────────
        if (!company_id || !name || latitude === undefined || longitude === undefined) {
            return sendError(res, 'company_id, name, latitude and longitude are all required', 400);
        }

        const companyId = parseInt(company_id, 10);
        if (isNaN(companyId) || companyId <= 0) {
            return sendError(res, 'company_id must be a positive integer', 400);
        }

        const trimmedName = String(name).trim();
        if (trimmedName.length === 0 || trimmedName.length > 150) {
            return sendError(res, 'name must be between 1 and 150 characters', 400);
        }

        let lat, lng;
        try {
            lat = parseCoord(latitude,  'latitude');
            lng = parseCoord(longitude, 'longitude');
        } catch (e) {
            return sendError(res, e.message, 400);
        }

        // ── Validate coordinate ranges ────────────────────────────────────
        if (lat < -90 || lat > 90) {
            return sendError(res, 'latitude must be between -90 and 90', 400);
        }
        if (lng < -180 || lng > 180) {
            return sendError(res, 'longitude must be between -180 and 180', 400);
        }

        // ── Confirm company exists ────────────────────────────────────────
        const company = await Company.findByPk(companyId, { attributes: ['id'] });
        if (!company) {
            return sendError(res, `Company with id ${companyId} does not exist`, 404);
        }

        // ── Check for duplicate name within the same company ──────────────
        const existing = await BusStop.findOne({
            where: { company_id: companyId, name: trimmedName },
        });
        if (existing) {
            return sendError(res, `A stop named "${trimmedName}" already exists for this company`, 409);
        }

        // ── Create ────────────────────────────────────────────────────────
        const stop = await BusStop.create({
            company_id: companyId,
            name:       trimmedName,
            latitude:   lat,
            longitude:  lng,
        });

        logger.info(`[BusStop] Created stop #${stop.id} "${stop.name}" for company ${companyId}`);

        return sendSuccess(res, {
            id:         stop.id,
            company_id: stop.company_id,
            name:       stop.name,
            latitude:   parseFloat(stop.latitude),
            longitude:  parseFloat(stop.longitude),
            created_at: stop.created_at,
        }, 201);

    } catch (err) {
        // Sequelize unique constraint — race condition fallback
        if (err.name === 'SequelizeUniqueConstraintError') {
            return sendError(res, 'A stop with that name already exists for this company', 409);
        }
        logger.error(`[BusStop] create error: ${err.message}`);
        return sendError(res, 'Failed to create bus stop');
    }
}

// ─────────────────────────────────────────
// DELETE /api/bus-stops/:id
// Deletes a bus stop by ID.
// Admin-only — protected by ADMIN_SECRET header.
// ─────────────────────────────────────────

async function remove(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id <= 0) {
            return sendError(res, 'id must be a positive integer', 400);
        }

        const stop = await BusStop.findByPk(id);
        if (!stop) {
            return sendError(res, `Bus stop #${id} not found`, 404);
        }

        const name       = stop.name;
        const company_id = stop.company_id;

        await stop.destroy();

        logger.info(`[BusStop] Deleted stop #${id} "${name}" (company ${company_id})`);

        return sendSuccess(res, { id, deleted: true });

    } catch (err) {
        logger.error(`[BusStop] remove error: ${err.message}`);
        return sendError(res, 'Failed to delete bus stop');
    }
}

module.exports = { listByCompany, listAll, create, remove };