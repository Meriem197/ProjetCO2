const { DataTypes } = require('sequelize');

/**
 * PositioningPosition — Positions temporaires de test pour optimisation IA.
 *
 * Note InfluxDB:
 * - Les mesures CO₂ collectées pendant un test DOIVENT être taggées avec `positionId`
 *   (ou `position_id`) afin que /positioning/compare puisse agréger correctement.
 */
module.exports = function definePositioningPosition(sequelize) {
  return sequelize.define(
    'PositioningPosition',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      companyId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'company_id', index: true },
      name: { type: DataTypes.STRING(128), allowNull: false },
      zone: { type: DataTypes.STRING(255), allowNull: false },
      durationMinutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 30, field: 'duration_minutes' },

      // Optionnel: si le capteur a un identifiant distinct par position (sinon tag positionId suffit)
      sensorId: { type: DataTypes.STRING(128), allowNull: true, field: 'sensor_id' },

      isFinal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_final' },
      finalizedAt: { type: DataTypes.DATE, allowNull: true, field: 'finalized_at' }
    },
    {
      tableName: 'positioning_positions',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );
};

