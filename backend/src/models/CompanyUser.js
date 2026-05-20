const { DataTypes } = require('sequelize');

module.exports = function defineCompanyUser(sequelize) {
  return sequelize.define(
    'CompanyUser',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      companyId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'company_id' },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
      membershipStatus: {
        type: DataTypes.ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'REMOVED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
        field: 'membership_status'
      },
      invitedByUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'invited_by_user_id' },
      invitedAt: { type: DataTypes.DATE, allowNull: true, field: 'invited_at' },
      joinedAt: { type: DataTypes.DATE, allowNull: true, field: 'joined_at' }
    },
    {
      tableName: 'company_users',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );
};
