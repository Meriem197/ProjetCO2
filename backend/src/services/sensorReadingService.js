const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/mysql');
const { Sensor } = require('../models');

function isMysqlEnabled() {
  return String(process.env.MYSQL_ENABLED || 'true').toLowerCase() !== 'false';
}

function parseRelativeStartToDate(startTime = '-24h') {
  const match = /^-(\d+)(ms|s|m|h|d|w)$/.exec(String(startTime || '-24h').trim());
  if (!match) return new Date(Date.now() - 24 * 60 * 60 * 1000);

  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
  }[unit];

  return new Date(Date.now() - value * unitMs);
}

async function ensureSensorReadingsSchema() {
  if (!isMysqlEnabled()) return;

  await sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      sensor_uid VARCHAR(128) NOT NULL,
      sensor_id BIGINT UNSIGNED NULL,
      co2_ppm DECIMAL(10,3) NOT NULL,
      temperature_c DECIMAL(10,3) NULL,
      humidity_pct DECIMAL(10,3) NULL,
      received_at DATETIME(3) NOT NULL,
      topic VARCHAR(255) NOT NULL,
      raw_payload JSON NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_sr_sensor_uid_received_at (sensor_uid, received_at),
      INDEX idx_sr_received_at (received_at),
      INDEX idx_sr_sensor_id (sensor_id),
      CONSTRAINT fk_sensor_readings_sensor
        FOREIGN KEY (sensor_id) REFERENCES sensors(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `
  );

  console.log('[mysql] Table sensor_readings prête');
}

async function persistSensorReading({ sensorUid, valuePpm, temperature, humidity, timestamp, topic, rawPayload }) {
  if (!isMysqlEnabled()) return { persisted: false, reason: 'MYSQL_DISABLED' };

  const safeSensorUid = String(sensorUid || '').trim();
  if (!safeSensorUid) return { persisted: false, reason: 'INVALID_SENSOR_UID' };

  let sensorId = null;
  try {
    const sensor = await Sensor.findOne({ where: { sensorUid: safeSensorUid }, attributes: ['id'] });
    sensorId = sensor?.id || null;
  } catch (err) {
    console.warn('[mysql] lookup sensor_uid échoué:', err.message);
  }

  await sequelize.query(
    `
      INSERT INTO sensor_readings
      (sensor_uid, sensor_id, co2_ppm, temperature_c, humidity_pct, received_at, topic, raw_payload)
      VALUES (:sensorUid, :sensorId, :co2Ppm, :temperature, :humidity, :receivedAt, :topic, :rawPayload)
    `,
    {
      type: QueryTypes.INSERT,
      replacements: {
        sensorUid: safeSensorUid,
        sensorId,
        co2Ppm: Number(valuePpm),
        temperature: temperature === undefined ? null : Number(temperature),
        humidity: humidity === undefined ? null : Number(humidity),
        receivedAt: timestamp instanceof Date ? timestamp : new Date(timestamp),
        topic: String(topic || ''),
        rawPayload: rawPayload ? JSON.stringify(rawPayload) : null
      }
    }
  );

  return { persisted: true, sensorId };
}

async function queryHistoricalDataFromMySQL(sensorUid, startTime = '-24h') {
  if (!isMysqlEnabled()) return [];

  const rows = await sequelize.query(
    `
      SELECT sensor_uid, co2_ppm, received_at
      FROM sensor_readings
      WHERE sensor_uid = :sensorUid
      AND received_at >= :startAt
      ORDER BY received_at ASC
    `,
    {
      type: QueryTypes.SELECT,
      replacements: {
        sensorUid: String(sensorUid || '').trim(),
        startAt: parseRelativeStartToDate(startTime)
      }
    }
  );

  return rows.map((row) => ({
    time: new Date(row.received_at).toISOString(),
    value: Number(row.co2_ppm),
    sensorId: row.sensor_uid
  }));
}

module.exports = {
  ensureSensorReadingsSchema,
  persistSensorReading,
  queryHistoricalDataFromMySQL
};
