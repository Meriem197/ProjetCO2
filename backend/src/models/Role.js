const { DataTypes } = require('sequelize');

module.exports = function defineRole(sequelize) {
  return sequelize.define(
    'Role',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.STRING(500), allowNull: true },
      isSystemRole: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_system_role' }
    },
    {
      tableName: 'roles',
      underscored: true,
      timestamps: false
    }
  );
};
