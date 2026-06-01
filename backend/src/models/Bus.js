const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Bus = sequelize.define('Bus', {
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
        mac_id: {
            type:      DataTypes.STRING(50),
            allowNull: false,
            unique:    true,
            comment:   'GPS device MAC ID — used to match incoming GPS records to this bus',
        },
        plate: {
            type:      DataTypes.STRING(20),
            allowNull: false,
            unique:    true,
            comment:   'Vehicle licence plate number',
        },
        model: {
            type:      DataTypes.STRING(100),
            allowNull: true,
            comment:   'Bus model e.g. Toyota Coaster, Yutong ZK6122',
        },
    }, {
        tableName:  'buses',
        timestamps: true,
        createdAt:  'created_at',
        updatedAt:  'updated_at',
    });

    Bus.associate = (models) => {
        // A bus belongs to one company
        Bus.belongsTo(models.Company, {
            foreignKey: 'company_id',
            as:         'company',
        });

        // A bus has many location records
        Bus.hasMany(models.Location, {
            foreignKey: 'bus_id',
            as:         'locations',
            onDelete:   'CASCADE',
        });
    };

    return Bus;
};