const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Company = sequelize.define('Company', {
        id: {
            type:          DataTypes.INTEGER.UNSIGNED,
            primaryKey:    true,
            autoIncrement: true,
        },
        name: {
            type:      DataTypes.STRING(150),
            allowNull: false,
            unique:    true,
        },
        slug: {
            type:      DataTypes.STRING(150),
            allowNull: false,
            unique:    true,
            comment:   'URL-friendly version of the name e.g. mtn-cameroon',
        },
        logo_url: {
            type:      DataTypes.TEXT,
            allowNull: true,
            comment:   'Cloudflare R2 public CDN URL',
        },
        logo_key: {
            type:      DataTypes.TEXT,
            allowNull: true,
            comment:   'R2 object key used for deletion e.g. logos/1/uuid.webp',
        },
    }, {
        tableName:  'companies',
        timestamps: true,
        createdAt:  'created_at',
        updatedAt:  'updated_at',
    });

    Company.associate = (models) => {
        Company.hasMany(models.Bus, {
            foreignKey: 'company_id',
            as:         'buses',
            onDelete:   'CASCADE',
        });
        Company.hasMany(models.BusStop, {
            foreignKey: 'company_id',
            as:         'busStops',
            onDelete:   'CASCADE',
        });
    };

    return Company;
};