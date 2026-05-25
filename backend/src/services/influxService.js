/**
 * =============================================================================
 * influxService.js — CLIENT INFLUXDB (ECRITURE + REQUETES FLUX)
 * =============================================================================
 * InfluxDB stocke des series temporelles : chaque point a un temps, une mesure (measurement),
 * des tags (dimensions indexees) et des fields (valeurs).
 *
 * connectInflux : initialise writeApi (precision ms) et queryApi pour l'organisation + bucket.
 * writePoint : construit un Point @influxdata/influxdb-client, flush immediat (pas de batch long).
 * queryHistoricalData : Flux query — attention sensorId doit etre de confiance (valide cote API).
 * =============================================================================
 */

const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const { queryHistoricalDataFromMySQL } = require('./sensorReadingService');

const url = process.env.INFLUX_URL || 'http://localhost:8086';
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET || 'co2_data';

let writeApi = null;
let queryApi = null;
let influxClient = null;

async function connectInflux() {
  const client = new InfluxDB({ url, token });
  influxClient = client;
  writeApi = client.getWriteApi(org, bucket, 'ms');
  queryApi = client.getQueryApi(org);
  console.log('[influx] Connecte');
}

async function writePoint({ measurement, tags, fields, timestamp }) {
  if (!writeApi) throw new Error('InfluxDB non initialise');

  const point = new Point(measurement);
  Object.entries(tags).forEach(([key, value]) => point.tag(key, value));
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      point.floatField(key, numericValue);
    }
  });
  if (timestamp) point.timestamp(timestamp);

  writeApi.writePoint(point);
  await writeApi.flush();
}

function assertSafeSensorId(sensorId) {
  if (typeof sensorId !== 'string' || !/^[\w-]+$/.test(sensorId)) {
    throw new Error('sensorId invalide pour la requete Influx');
  }
}

async function queryHistoricalData(sensorId, startTime = '-24h') {
  assertSafeSensorId(sensorId);
  if (!queryApi) {
    throw new Error('InfluxDB queryApi non initialise');
  }
  const query = `
    from(bucket: "${bucket}")
      |> range(start: ${startTime})
      |> filter(fn: (r) => r._measurement == "co2_readings")
      |> filter(fn: (r) => r.sensorId == "${sensorId}")
      |> filter(fn: (r) => r._field == "value")
      |> sort(columns: ["_time"])
  `;

  const results = [];
  await queryApi.collectRows(query, (row, tableMeta) => {
    const obj = tableMeta.toObject(row);
    results.push({
      time: obj._time,
      value: obj._value,
      sensorId: obj.sensorId
    });
  });
  return results;
}

async function queryHistoricalDataResilient(sensorId, startTime = '-24h') {
  try {
    const influxRows = await queryHistoricalData(sensorId, startTime);
    if (influxRows.length > 0) return influxRows;
  } catch (err) {
    console.warn(`[influx] queryHistoricalData fallback MySQL: ${err.message}`);
  }
  return queryHistoricalDataFromMySQL(sensorId, startTime);
}

/**
 * Execute un Flux query fourni (sans injection dans la query : le query est construit côté service).
 * Collecte toutes les rows et les retourne sous forme d'objets Influx.
 */
async function queryFluxRows(fluxQuery) {
  if (!queryApi) {
    throw new Error('InfluxDB queryApi non initialise');
  }
  const rows = [];
  await queryApi.collectRows(fluxQuery, (row, tableMeta) => {
    rows.push(tableMeta.toObject(row));
  });
  return rows;
}

/** Derniere mesure CO2 sur une fenetre courte (classification sans parametre value). */
async function queryLastCo2Value(sensorId) {
  assertSafeSensorId(sensorId);
  if (!queryApi) {
    throw new Error('InfluxDB queryApi non initialise');
  }
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -2h)
      |> filter(fn: (r) => r._measurement == "co2_readings")
      |> filter(fn: (r) => r.sensorId == "${sensorId}")
      |> filter(fn: (r) => r._field == "value")
      |> last()
  `;
  const rows = [];
  await queryApi.collectRows(query, (row, tableMeta) => {
    rows.push(tableMeta.toObject(row));
  });
  if (rows.length === 0) return null;
  const obj = rows[0];
  return {
    time: obj._time,
    value: obj._value,
    sensorId: obj.sensorId
  };
}

async function queryActiveSensorIds(startTime = '-30d') {
  if (!queryApi) {
    throw new Error('InfluxDB queryApi non initialise');
  }
  const query = `
    from(bucket: "${bucket}")
      |> range(start: ${startTime})
      |> filter(fn: (r) => r._measurement == "co2_readings")
      |> filter(fn: (r) => r._field == "value")
      |> group(columns: ["sensorId"])
      |> last()
  `;
  const out = [];
  await queryApi.collectRows(query, (row, tableMeta) => {
    const obj = tableMeta.toObject(row);
    if (obj.sensorId && !out.includes(obj.sensorId)) out.push(obj.sensorId);
  });
  return out;
}

/** Dernière ligne capteur (CO2 + télémétrie optionnelle) pour le bandeau UI. */
async function queryLatestSensorTelemetry(sensorId) {
  assertSafeSensorId(sensorId);
  if (!queryApi) {
    throw new Error('InfluxDB queryApi non initialise');
  }
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -6h)
      |> filter(fn: (r) => r._measurement == "co2_readings")
      |> filter(fn: (r) => r.sensorId == "${sensorId}")
      |> filter(fn: (r) => r._field == "value" or r._field == "battery" or r._field == "wifiRssi" or r._field == "temperature" or r._field == "humidity")
      |> last()
  `;
  const rows = [];
  await queryApi.collectRows(query, (row, tableMeta) => {
    rows.push(tableMeta.toObject(row));
  });
  const out = { time: null, value: null, battery: null, wifiRssi: null, temperature: null, humidity: null };
  for (const r of rows) {
    if (!out.time && r._time) out.time = r._time;
    const field = r._field;
    const val = Number(r._value);
    if (!Number.isFinite(val)) continue;
    if (field === 'value') out.value = val;
    if (field === 'battery') out.battery = val;
    if (field === 'wifiRssi') out.wifiRssi = val;
    if (field === 'temperature') out.temperature = val;
    if (field === 'humidity') out.humidity = val;
  }
  return out;
}

module.exports = {
  connectInflux,
  writePoint,
  queryHistoricalData,
  queryHistoricalDataResilient,
  queryFluxRows,
  queryLastCo2Value,
  queryLatestSensorTelemetry,
  queryActiveSensorIds,
  getInfluxClient: () => influxClient,
  getWriteApi: () => writeApi
};

