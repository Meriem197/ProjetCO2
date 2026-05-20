const { DataTypes } = require('sequelize');

module.exports = function defineAlert(sequelize) {
  return sequelize.define(
    'Alert',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      companyId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'company_id' },
      siteId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'site_id' },
      sensorId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'sensor_id' },
      alertType: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'THRESHOLD_BREACH', field: 'alert_type' },
      severity: { type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'), allowNull: false },
      status: { type: DataTypes.ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED'), allowNull: false, defaultValue: 'OPEN' },
      triggeredAt: { type: DataTypes.DATE, allowNull: false, field: 'triggered_at' },
      acknowledgedAt: { type: DataTypes.DATE, allowNull: true, field: 'acknowledged_at' },
      resolvedAt: { type: DataTypes.DATE, allowNull: true, field: 'resolved_at' },
      acknowledgedByCompanyUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'acknowledged_by_company_user_id' },
      resolvedByCompanyUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'resolved_by_company_user_id' },
      triggerValue: { type: DataTypes.DECIMAL(10, 3), allowNull: true, field: 'trigger_value' },
      thresholdValue: { type: DataTypes.DECIMAL(10, 3), allowNull: true, field: 'threshold_value' },
      message: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true }
    },
    {
      tableName: 'alerts',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );
};
