const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');
const { Sensor } = require('../models');

function isMysqlEnabled() {
  return String(process.env.MYSQL_ENABLED || 'true').toLowerCase() !== 'false';
}

function normalizeSensorId(value) {
  return String(value || '').trim();
}

function isValidSensorId(value) {
  const sensorId = normalizeSensorId(value);
  return /^[\w-]+$/.test(sensorId);
}

function envSensorCandidates() {
  return [
    process.env.SENSOR_ID,
    process.env.DEFAULT_SENSOR_ID,
    process.env.MQTT_SENSOR_ID,
    process.env.VITE_SENSOR_ID
  ]
    .map(normalizeSensorId)
    .filter(Boolean);
}

async function listRecentSensorUidsFromMySQL(limit = 10) {
  if (!isMysqlEnabled()) return [];

  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

  try {
    const readingRows = await sequelize.query(
      `
        SELECT sensor_uid AS sensorUid
        FROM sensor_readings
        WHERE sensor_uid IS NOT NULL AND sensor_uid <> ''
        GROUP BY sensor_uid
        ORDER BY MAX(received_at) DESC
        LIMIT :limit
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { limit: safeLimit }
      }
    );

    const fromReadings = readingRows
      .map((row) => normalizeSensorId(row.sensorUid))
      .filter(isValidSensorId);

    if (fromReadings.length > 0) return [...new Set(fromReadings)].slice(0, safeLimit);
  } catch (err) {
    console.warn('[sensorResolver] lecture sensor_readings indisponible:', err.message);
  }

  try {
    const sensors = await Sensor.findAll({
      attributes: ['sensorUid'],
      order: [['updatedAt', 'DESC']],
      limit: safeLimit
    });

    return [
      ...new Set(
        sensors
          .map((row) => normalizeSensorId(row.sensorUid))
          .filter(isValidSensorId)
      )
    ].slice(0, safeLimit);
  } catch (err) {
    console.warn('[sensorResolver] lecture sensors indisponible:', err.message);
    return [];
  }
}

async function resolveSensorId(requestedSensorId = '') {
  const requested = normalizeSensorId(requestedSensorId);
  if (requested) return isValidSensorId(requested) ? requested : null;

  const envCandidate = envSensorCandidates().find(isValidSensorId);
  if (envCandidate) return envCandidate;

  const recent = await listRecentSensorUidsFromMySQL(1);
  return recent[0] || null;
}

module.exports = {
  resolveSensorId,
  isValidSensorId,
  listRecentSensorUidsFromMySQL
};
