const { DataTypes } = require('sequelize');

module.exports = function defineCompany(sequelize) {
  return sequelize.define(
    'Company',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      tenantKey: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'tenant_key' },
      legalName: { type: DataTypes.STRING(255), allowNull: false, field: 'legal_name' },
      displayName: { type: DataTypes.STRING(255), allowNull: false, field: 'display_name' },
      status: { type: DataTypes.ENUM('ACTIVE', 'SUSPENDED', 'ARCHIVED'), allowNull: false, defaultValue: 'ACTIVE' },
      timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'UTC' },
      deletedAt: { type: DataTypes.DATE, allowNull: true, field: 'deleted_at' }
    },
    {
      tableName: 'companies',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );
};
