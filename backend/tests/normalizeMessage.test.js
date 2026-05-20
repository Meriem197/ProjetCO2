const {
  parseTimestampToDate,
  resolveSensorId,
  normalizeMqttPayload
} = require('../src/mqtt/normalizeMessage');

describe('normalizeMessage', () => {
  test('resolveSensorId priorise dev_id puis fallback topic', () => {
    expect(resolveSensorId('sensors/co2', { dev_id: 'ESP32_CO2_01' })).toBe('ESP32_CO2_01');
    expect(resolveSensorId('esp32/bureau/co2', {})).toBe('bureau');
    expect(resolveSensorId('unknown/topic', {})).toBe('unknown');
  });

  test('parseTimestampToDate accepte secondes unix', () => {
    const d = parseTimestampToDate(1718000000);
    expect(d instanceof Date).toBe(true);
    expect(Number.isNaN(d.getTime())).toBe(false);
    expect(d.getUTCFullYear()).toBeGreaterThanOrEqual(2024);
  });

  test('normalizeMqttPayload convertit format PFEhard', () => {
    const payload = JSON.stringify({
      dev_id: 'ESP32_CO2_01',
      co2: 900,
      ts: 1718000000
    });
    const normalized = normalizeMqttPayload('sensors/co2', payload);
    expect(normalized.sensorId).toBe('ESP32_CO2_01');
    expect(normalized.value).toBe(900);
    expect(normalized.unit).toBe('ppm');
    expect(Number.isNaN(normalized.timestamp.getTime())).toBe(false);
  });

  test('normalizeMqttPayload rejette JSON invalide', () => {
    expect(() => normalizeMqttPayload('sensors/co2', '{invalid')).toThrow('Payload MQTT JSON invalide');
  });
});
