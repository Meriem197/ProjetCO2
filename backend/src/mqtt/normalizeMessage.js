const { HttpError } = require('../utils/httpError');

function parseTimestampToDate(value) {
  if (value === undefined || value === null || value === '') return new Date();

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value < 1e12 ? value * 1000 : value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return new Date();
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return new Date(numeric < 1e12 ? numeric * 1000 : numeric);
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? new Date('invalid') : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date('invalid') : parsed;
}

function resolveSensorId(topic, data) {
  const fromPayload = [data?.sensorId, data?.dev_id].find(
    (v) => typeof v === 'string' && v.trim().length > 0
  );
  if (fromPayload) return fromPayload.trim();

  const topicParts = String(topic || '').split('/');
  if (topicParts.length >= 3 && topicParts[0] === 'esp32' && topicParts[1]) {
    return topicParts[1];
  }

  return 'unknown';
}

function normalizeMqttPayload(topic, rawMessage) {
  let data;
  try {
    data = JSON.parse(rawMessage);
  } catch {
    throw new HttpError(400, 'Payload MQTT JSON invalide', 'MQTT_INVALID_JSON');
  }

  return {
    sensorId: resolveSensorId(topic, data),
    value: parseFloat(data.co2),
    temperature: data.temp !== undefined ? parseFloat(data.temp) : undefined,
    humidity: data.hum !== undefined ? parseFloat(data.hum) : undefined,
    latitude: data.gps?.lat !== undefined ? parseFloat(data.gps.lat) : undefined,
    longitude: data.gps?.lng !== undefined ? parseFloat(data.gps.lng) : undefined,
    altitude: data.gps?.alt !== undefined ? parseFloat(data.gps.alt) : undefined,
    wifiRssi: data.telemetry?.wifi_rssi !== undefined ? parseFloat(data.telemetry.wifi_rssi) : undefined,
    mqttStatus: data.telemetry?.mqtt_status !== undefined ? Number(data.telemetry.mqtt_status) : undefined,
    battery: data.telemetry?.battery !== undefined ? parseFloat(data.telemetry.battery) : undefined,
    unit: 'ppm',
    timestamp: parseTimestampToDate(data.timestamp ?? data.ts)
  };
}

module.exports = {
  parseTimestampToDate,
  resolveSensorId,
  normalizeMqttPayload
};
