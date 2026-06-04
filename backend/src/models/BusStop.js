const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const BusStop = sequelize.define('BusStop', {
        id: {
            type:          DataTypes.INTEGER.UNSIGNED,
            primaryKey:    true,
            autoIncrement: true,
        },
        company_id: {
            type:       DataTypes.INTEGER.UNSIGNED,
            allowNull:  false,
            references: {
                model: 'companies',
                key:   'id',
            },
        },
        name: {
            type:      DataTypes.STRING(150),
            allowNull: false,
        },
        latitude: {
            type:      DataTypes.DECIMAL(10, 7),
            allowNull: false,
        },
        longitude: {
            type:      DataTypes.DECIMAL(10, 7),
            allowNull: false,
        },
    }, {
        tableName:  'bus_stops',
        timestamps: true,
        createdAt:  'created_at',
        updatedAt:  'updated_at',
    });

    BusStop.associate = (models) => {
        BusStop.belongsTo(models.Company, {
            foreignKey: 'company_id',
            as:         'company',
        });
    };

    return BusStop;
};