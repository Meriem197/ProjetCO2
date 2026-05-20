const { DataTypes } = require('sequelize');

module.exports = function defineSensor(sequelize) {
  return sequelize.define(
    'Sensor',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      edgeDeviceId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'edge_device_id' },
      sensorUid: { type: DataTypes.STRING(128), allowNull: false, unique: true, field: 'sensor_uid' },
      name: { type: DataTypes.STRING(255), allowNull: false },
      sensorType: { type: DataTypes.ENUM('CO2', 'TEMPERATURE', 'HUMIDITY', 'MULTI'), allowNull: false, field: 'sensor_type' },
      unitDefault: { type: DataTypes.STRING(16), allowNull: true, field: 'unit_default' },
      samplingIntervalMs: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 5000, field: 'sampling_interval_ms' },
      calibrationOffset: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: 0, field: 'calibration_offset' },
      calibrationScale: { type: DataTypes.DECIMAL(10, 6), allowNull: false, defaultValue: 1, field: 'calibration_scale' },
      installedAt: { type: DataTypes.DATE, allowNull: true, field: 'installed_at' },
      status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'FAULTY', 'MAINTENANCE'), allowNull: false, defaultValue: 'ACTIVE' }
    },
    {
      tableName: 'sensors',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );
};
