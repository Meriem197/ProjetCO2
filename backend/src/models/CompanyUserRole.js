const { DataTypes } = require('sequelize');

module.exports = function defineCompanyUserRole(sequelize) {
  return sequelize.define(
    'CompanyUserRole',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      companyUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'company_user_id' },
      roleId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'role_id' },
      assignedByCompanyUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'assigned_by_company_user_id' },
      assignedAt: { type: DataTypes.DATE, allowNull: false, field: 'assigned_at' }
    },
    {
      tableName: 'company_user_roles',
      underscored: true,
      timestamps: false
    }
  );
};
