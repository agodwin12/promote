const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');
require('dotenv').config();

// ─────────────────────────────────────────
// SEQUELIZE INSTANCE
// ─────────────────────────────────────────
const sequelize = new Sequelize(
    process.env.DB_NAME     || 'BusTrack',
    process.env.DB_USER     || 'root',
    process.env.DB_PASSWORD || 'Proxym2024!',
    {
        host:    process.env.DB_HOST || 'localhost',
        port:    parseInt(process.env.DB_PORT || '3306'),
        dialect: 'mysql',

        pool: {
            min:     parseInt(process.env.DB_POOL_MIN || '2'),
            max:     parseInt(process.env.DB_POOL_MAX || '20'),
            acquire: 30000,   // ms to wait before throwing an acquire error
            idle:    10000,   // ms a connection can sit idle before being released
        },

        // Route Sequelize's internal logs through Winston
        logging: (msg) => logger.debug(msg),

        define: {
            // All models use snake_case column names by default
            underscored:    true,
            freezeTableName: true, // don't pluralise table names automatically
        },

        dialectOptions: {
            // Allow '0000-00-00 00:00:00' GPS timestamps
            dateStrings: true,
            typeCast(field, next) {
                if (field.type === 'DATETIME' || field.type === 'TIMESTAMP') {
                    const val = field.string();
                    if (!val || val.startsWith('0000')) return null;
                    return new Date(val);
                }
                return next();
            },
        },
    }
);

// ─────────────────────────────────────────
// LOAD MODELS
// Each model file exports a function that receives
// the sequelize instance and returns the model class.
// ─────────────────────────────────────────
const Company  = require('../models/Company')(sequelize);
const Bus      = require('../models/Bus')(sequelize);
const Location = require('../models/Location')(sequelize);

// ─────────────────────────────────────────
// RUN ASSOCIATIONS
// Each model declares its own associations in an
// associate() method. We call them all here once
// all models are loaded so cross-references resolve.
// ─────────────────────────────────────────
const models = { Company, Bus, Location };

Object.values(models).forEach((model) => {
    if (typeof model.associate === 'function') {
        model.associate(models);
    }
});

// ─────────────────────────────────────────
// VERIFY CONNECTION ON STARTUP
// ─────────────────────────────────────────
async function verifyConnection() {
    try {
        await sequelize.authenticate();
        logger.info('✅ MySQL (Sequelize) connected successfully');
    } catch (error) {
        logger.error('🔥 MySQL connection failed:', error.message);
        process.exit(1);
    }
}

// ─────────────────────────────────────────
// SYNC — development only
// In production, use migrations instead.
// Call syncDatabase() manually when you need to
// rebuild tables in a dev environment.
// ─────────────────────────────────────────
async function syncDatabase(force = false) {
    try {
        await sequelize.sync({ force, alter: !force });
        logger.info(`✅ Database synced (force=${force})`);
    } catch (error) {
        logger.error('🔥 Database sync failed:', error.message);
        throw error;
    }
}

// ─────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────
async function closeConnection() {
    try {
        await sequelize.close();
        logger.info('✅ Sequelize connection closed');
    } catch (error) {
        logger.error('❌ Error closing Sequelize connection:', error.message);
    }
}

module.exports = {
    sequelize,
    models,
    verifyConnection,
    syncDatabase,
    closeConnection,
};