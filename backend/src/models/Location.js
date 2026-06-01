const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Location = sequelize.define('Location', {
        id: {
            type:          DataTypes.BIGINT.UNSIGNED,
            primaryKey:    true,
            autoIncrement: true,
            comment:       'BIGINT because location records accumulate fast at 10s intervals',
        },
        bus_id: {
            type:       DataTypes.INTEGER.UNSIGNED,
            allowNull:  true,
            references: {
                model: 'buses',
                key:   'id',
            },
            comment: 'NULL if GPS record arrived before the bus was registered in the system',
        },
        mac_id: {
            type:      DataTypes.STRING(50),
            allowNull: false,
            comment:   'Raw MAC ID from GPS provider — kept for traceability even if bus_id is NULL',
        },
        latitude: {
            type:      DataTypes.DECIMAL(10, 7),
            allowNull: false,
            comment:   'WGS84 latitude — already converted from GCJ-02 by gpsService',
        },
        longitude: {
            type:      DataTypes.DECIMAL(10, 7),
            allowNull: false,
            comment:   'WGS84 longitude — already converted from GCJ-02 by gpsService',
        },
        speed: {
            type:         DataTypes.DECIMAL(6, 2),
            allowNull:    true,
            defaultValue: 0,
            comment:      'Speed in km/h reported by the GPS device',
        },
        direction: {
            type:      DataTypes.SMALLINT.UNSIGNED,
            allowNull: true,
            comment:   'Heading in degrees 0-360',
        },
        status: {
            type:      DataTypes.STRING(20),
            allowNull: true,
            comment:   'Raw status string from GPS provider',
        },
        gps_quality: {
            type:         DataTypes.ENUM('VALID', 'LOW_CONFIDENCE'),
            allowNull:    false,
            defaultValue: 'VALID',
            comment:      'Quality classification assigned by the noise filter in gpsService',
        },
        sys_time: {
            type:      DataTypes.DATE,
            allowNull: true,
            comment:   'Timestamp from the GPS provider (device clock)',
        },
    }, {
        tableName:  'locations',
        timestamps: true,
        createdAt:  'created_at',
        updatedAt:  false,          // location rows are never updated, only inserted
        indexes: [
            {
                // Most common query: latest location for a given bus
                name:   'idx_bus_id_sys_time',
                fields: ['bus_id', 'sys_time'],
            },
            {
                // gpsService resolves bus_id from mac_id every cycle
                name:   'idx_mac_id',
                fields: ['mac_id'],
            },
            {
                // Time-range queries e.g. history playback
                name:   'idx_sys_time',
                fields: ['sys_time'],
            },
        ],
    });

    Location.associate = (models) => {
        Location.belongsTo(models.Bus, {
            foreignKey: 'bus_id',
            as:         'bus',
        });
    };

    return Location;
};