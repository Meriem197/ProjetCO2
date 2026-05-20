const { DataTypes } = require('sequelize');

module.exports = function defineProductionLine(sequelize) {
  return sequelize.define(
    'ProductionLine',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      siteId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'site_id' },
      lineCode: { type: DataTypes.STRING(64), allowNull: false, field: 'line_code' },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.STRING(500), allowNull: true },
      status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE'), allowNull: false, defaultValue: 'ACTIVE' }
    },
    {
      tableName: 'production_lines',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );
};
