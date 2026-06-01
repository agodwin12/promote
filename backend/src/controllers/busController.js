const { models }          = require('../config/database');
const { getVehicleLocation } = require('../config/redis');
const logger              = require('../utils/logger');

const { Bus, Company, Location } = models;

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function sendSuccess(res, data, statusCode = 200) {
    return res.status(statusCode).json({ success: true, data });
}

function sendError(res, message, statusCode = 500) {
    logger.error(`API error [${statusCode}]: ${message}`);
    return res.status(statusCode).json({ success: false, error: message });
}

// ─────────────────────────────────────────
// GET /api/buses
// All buses across all companies.
// ─────────────────────────────────────────
async function getAll(req, res) {
    try {
        const buses = await Bus.findAll({
            attributes: ['id', 'plate', 'model', 'mac_id', 'company_id', 'created_at'],
            include: [
                {
                    model:      Company,
                    as:         'company',
                    attributes: ['id', 'name', 'slug', 'logo_url'],
                },
            ],
            order: [['plate', 'ASC']],
        });

        return sendSuccess(res, buses.map((b) => b.toJSON()));

    } catch (error) {
        logger.error('🔥 getAll buses error:', error.message);
        return sendError(res, 'Failed to fetch buses');
    }
}

// ─────────────────────────────────────────
// GET /api/buses/:id
// Single bus with its company and latest location.
// Checks Redis first for the live position —
// falls back to DB if cache is cold.
// ─────────────────────────────────────────
async function getOne(req, res) {
    const { id } = req.params;

    try {
        const bus = await Bus.findByPk(id, {
            attributes: ['id', 'plate', 'model', 'mac_id', 'company_id', 'created_at'],
            include: [
                {
                    model:      Company,
                    as:         'company',
                    attributes: ['id', 'name', 'slug', 'logo_url'],
                },
            ],
        });

        if (!bus) {
            return sendError(res, 'Bus not found', 404);
        }

        const busData = bus.toJSON();

        // Try Redis first for the latest GPS position
        let location = await getVehicleLocation(id);

        // Fall back to DB if cache is cold (e.g. after server restart)
        if (!location) {
            const dbLocation = await Location.findOne({
                where:      { bus_id: id },
                attributes: [
                    'latitude', 'longitude', 'speed',
                    'direction', 'status', 'gps_quality', 'sys_time',
                ],
                order: [['sys_time', 'DESC']],
            });
            location = dbLocation ? dbLocation.toJSON() : null;
        }

        return sendSuccess(res, { ...busData, location });

    } catch (error) {
        logger.error(`🔥 getOne bus ${id} error:`, error.message);
        return sendError(res, 'Failed to fetch bus');
    }
}

// ─────────────────────────────────────────
// POST /api/buses
// Register a new bus under a company.
// ─────────────────────────────────────────
async function create(req, res) {
    const { company_id, plate, model, mac_id } = req.body;

    if (!company_id) return sendError(res, 'company_id is required', 400);
    if (!plate?.trim()) return sendError(res, 'plate is required', 400);
    if (!mac_id?.trim()) return sendError(res, 'mac_id is required', 400);

    try {
        // Verify company exists
        const company = await Company.findByPk(company_id, {
            attributes: ['id', 'name'],
        });

        if (!company) {
            return sendError(res, 'Company not found', 404);
        }

        // Check for duplicate plate or mac_id
        const existing = await Bus.findOne({
            where: {
                [require('sequelize').Op.or]: [
                    { plate:  plate.trim() },
                    { mac_id: mac_id.trim() },
                ],
            },
        });

        if (existing) {
            const field = existing.plate === plate.trim() ? 'plate' : 'mac_id';
            return sendError(res, `A bus with this ${field} already exists`, 409);
        }

        const bus = await Bus.create({
            company_id,
            plate:  plate.trim().toUpperCase(),
            model:  model?.trim() || null,
            mac_id: mac_id.trim(),
        });

        logger.info(
            `✅ Bus created: id=${bus.id}, plate=${bus.plate}, ` +
            `mac_id=${bus.mac_id}, company=${company.name}`
        );

        return sendSuccess(res, bus.toJSON(), 201);

    } catch (error) {
        logger.error('🔥 create bus error:', error.message);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return sendError(res, 'A bus with this plate or mac_id already exists', 409);
        }
        return sendError(res, 'Failed to create bus');
    }
}

// ─────────────────────────────────────────
// PUT /api/buses/:id
// Update bus details.
// ─────────────────────────────────────────
async function update(req, res) {
    const { id }                       = req.params;
    const { plate, model, mac_id, company_id } = req.body;

    try {
        const bus = await Bus.findByPk(id);

        if (!bus) {
            return sendError(res, 'Bus not found', 404);
        }

        // If company_id is being changed verify the new company exists
        if (company_id && company_id !== bus.company_id) {
            const company = await Company.findByPk(company_id, { attributes: ['id'] });
            if (!company) {
                return sendError(res, 'Target company not found', 404);
            }
        }

        await bus.update({
            company_id: company_id   || bus.company_id,
            plate:      plate?.trim().toUpperCase() || bus.plate,
            model:      model?.trim()               || bus.model,
            mac_id:     mac_id?.trim()              || bus.mac_id,
        });

        logger.info(`✅ Bus updated: id=${id}`);
        return sendSuccess(res, bus.toJSON());

    } catch (error) {
        logger.error(`🔥 update bus ${id} error:`, error.message);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return sendError(res, 'A bus with this plate or mac_id already exists', 409);
        }
        return sendError(res, 'Failed to update bus');
    }
}

// ─────────────────────────────────────────
// DELETE /api/buses/:id
// Remove a bus and all its location history.
// ─────────────────────────────────────────
async function remove(req, res) {
    const { id } = req.params;

    try {
        const bus = await Bus.findByPk(id, {
            attributes: ['id', 'plate', 'mac_id'],
        });

        if (!bus) {
            return sendError(res, 'Bus not found', 404);
        }

        // Location cascade is handled by the association onDelete: CASCADE
        await bus.destroy();

        logger.info(`✅ Bus deleted: id=${id}, plate=${bus.plate}`);
        return sendSuccess(res, {
            message: `Bus "${bus.plate}" deleted successfully`,
        });

    } catch (error) {
        logger.error(`🔥 remove bus ${id} error:`, error.message);
        return sendError(res, 'Failed to delete bus');
    }
}

// ─────────────────────────────────────────
// GET /api/buses/:id/location
// Latest GPS position for a single bus.
// Redis → DB fallback pattern.
// This is what the frontend calls on map init
// for a specific bus before Socket.IO kicks in.
// ─────────────────────────────────────────
async function getLocation(req, res) {
    const { id } = req.params;

    try {
        const bus = await Bus.findByPk(id, {
            attributes: ['id', 'plate', 'mac_id'],
        });

        if (!bus) {
            return sendError(res, 'Bus not found', 404);
        }

        // 1. Check Redis cache first
        let location = await getVehicleLocation(id);

        // 2. Fall back to DB
        if (!location) {
            const dbLocation = await Location.findOne({
                where:      { bus_id: id },
                attributes: [
                    'latitude', 'longitude', 'speed',
                    'direction', 'status', 'gps_quality', 'sys_time',
                ],
                order: [['sys_time', 'DESC']],
            });
            location = dbLocation ? dbLocation.toJSON() : null;
        }

        if (!location) {
            return sendError(res, 'No location data available for this bus yet', 404);
        }

        return sendSuccess(res, {
            bus_id:  parseInt(id),
            plate:   bus.plate,
            mac_id:  bus.mac_id,
            ...location,
        });

    } catch (error) {
        logger.error(`🔥 getLocation bus ${id} error:`, error.message);
        return sendError(res, 'Failed to fetch bus location');
    }
}

module.exports = {
    getAll,
    getOne,
    create,
    update,
    remove,
    getLocation,
};