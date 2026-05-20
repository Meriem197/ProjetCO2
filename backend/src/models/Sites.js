const { DataTypes } = require('sequelize');

module.exports = function defineSite(sequelize) {
  return sequelize.define(
    'Site',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      companyId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'company_id' },
      siteCode: { type: DataTypes.STRING(64), allowNull: false, field: 'site_code' },
      name: { type: DataTypes.STRING(255), allowNull: false },
      countryCode: { type: DataTypes.STRING(2), allowNull: true, field: 'country_code' },
      city: { type: DataTypes.STRING(100), allowNull: true },
      addressLine1: { type: DataTypes.STRING(255), allowNull: true, field: 'address_line1' },
      addressLine2: { type: DataTypes.STRING(255), allowNull: true, field: 'address_line2' },
      postalCode: { type: DataTypes.STRING(20), allowNull: true, field: 'postal_code' },
      latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
      longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
      status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE'), allowNull: false, defaultValue: 'ACTIVE' }
    },
    {
      tableName: 'sites',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );
};
