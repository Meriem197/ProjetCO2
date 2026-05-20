const { DataTypes } = require('sequelize');

module.exports = function defineEdgeDevice(sequelize) {
  return sequelize.define(
    'EdgeDevice',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      productionLineId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'production_line_id' },
      deviceUid: { type: DataTypes.STRING(128), allowNull: false, unique: true, field: 'device_uid' },
      name: { type: DataTypes.STRING(255), allowNull: false },
      hardwareModel: { type: DataTypes.STRING(100), allowNull: true, field: 'hardware_model' },
      firmwareVersion: { type: DataTypes.STRING(64), allowNull: true, field: 'firmware_version' },
      connectivityType: {
        type: DataTypes.ENUM('MQTT', 'HTTP', 'LORA', 'OTHER'),
        allowNull: false,
        defaultValue: 'MQTT',
        field: 'connectivity_type'
      },
      authKeyHash: { type: DataTypes.STRING(255), allowNull: true, field: 'auth_key_hash' },
      lastSeenAt: { type: DataTypes.DATE, allowNull: true, field: 'last_seen_at' },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DECOMMISSIONED'),
        allowNull: false,
        defaultValue: 'ACTIVE'
      }
    },
    {
      tableName: 'edge_devices',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );
};
