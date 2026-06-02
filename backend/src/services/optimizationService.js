const { Sensor, PositioningPosition, sequelize } = require('../models');
const mysqlService = require('./mysqlService');
const { queryFluxRows, queryHistoricalDataResilient } = require('./influxService');
const { HttpError } = require('../utils/httpError');

const STALE_MINUTES = 30;
const LOW_CONSTANT_MIN = 360;
const LOW_CONSTANT_MAX = 470;
const HIGH_AVERAGE = 1200;
const LOW_VARIATION = 35;
const VERY_LOW_VARIATION = 20;
const DEFAULT_CENTER = { latitude: 36.8065, longitude: 10.1815 };

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 1) {
  const n = toNumber(value);
  if (n === null) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function clampPercent(value, fallback) {
  const n = toNumber(value);
  if (n === null) return fallback;
  return Math.max(0, Math.min(100, round(n, 1)));
}

function hashText(input) {
  const text = String(input || 'sensor');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function defaultRelativeCoordinate(seed, axis) {
  const hash = hashText(`${seed}-${axis}`);
  return round(12 + (hash % 7600) / 100, 1);
}

function friendlyZoneName(sensor, index) {
  const rawZone = String(sensor.zone || '').trim();
  if (rawZone) return rawZone;

  const siteName = sensor.edgeDevice?.productionLine?.site?.name;
  if (siteName) return siteName;

  const labels = ['Zone A - Production', 'Zone B - Stockage', 'Zone C - Machines', 'Zone D - Opérateurs'];
  return labels[index % labels.length];
}

function friendlySensorName(sensor, index) {
  const zone = friendlyZoneName(sensor, index);
  const rawName = String(sensor.name || '').trim();
  const looksTechnical = /(^ESP|SENSOR|CO2_|-|_|\d{2,})/i.test(rawName);
  if (rawName && !looksTechnical) return rawName;
  return `Capteur ${zone}`;
}

function gpsFromSensorOrSite(sensor, positionX, positionY) {
  const sensorLat = toNumber(sensor.latitude);
  const sensorLng = toNumber(sensor.longitude);
  if (sensorLat !== null && sensorLng !== null) {
    return { latitude: round(sensorLat, 6), longitude: round(sensorLng, 6) };
  }

  const site = sensor.edgeDevice?.productionLine?.site;
  const siteLat = toNumber(site?.latitude);
  const siteLng = toNumber(site?.longitude);
  if (siteLat !== null && siteLng !== null) {
    return {
      latitude: round(siteLat + ((positionY - 50) / 100000), 6),
      longitude: round(siteLng + ((positionX - 50) / 100000), 6)
    };
  }

  return {
    latitude: round(DEFAULT_CENTER.latitude + ((positionY - 50) / 100000), 6),
    longitude: round(DEFAULT_CENTER.longitude + ((positionX - 50) / 100000), 6)
  };
}

function normalizeSensor(row, index) {
  const sensor = row && row.toJSON ? row.toJSON() : row;
  const sensorUid = String(sensor.sensorUid || sensor.mqttSensorId || sensor.id || '').trim();
  const positionX = clampPercent(sensor.positionX ?? sensor.position_x, defaultRelativeCoordinate(sensorUid || index, 'x'));
  const positionY = clampPercent(sensor.positionY ?? sensor.position_y, defaultRelativeCoordinate(sensorUid || index, 'y'));
  const gps = gpsFromSensorOrSite(sensor, positionX, positionY);
  const zone = friendlyZoneName(sensor, index);

  return {
    id: String(sensor.id || sensorUid || index),
    sensorUid,
    name: friendlySensorName({ ...sensor, zone }, index),
    zone,
    sensorType: String(sensor.sensorType || 'CO2').toUpperCase(),
    status: String(sensor.status || 'ACTIVE').toUpperCase(),
    positionX,
    positionY,
    latitude: gps.latitude,
    longitude: gps.longitude
  };
}

async function getConfiguredSensors(user) {
  try {
    const rows = await mysqlService.listSensors({}, user);
    const sensors = rows.map(normalizeSensor).filter((sensor) => sensor.sensorUid && ['CO2', 'MULTI'].includes(sensor.sensorType));
    if (sensors.length) return sensors;
  } catch (err) {
    console.warn(`[optimization] lecture capteurs par entreprise indisponible: ${err.message}`);
  }

  const rows = await Sensor.findAll({ order: [['sensorUid', 'ASC']], limit: 50 });
  return rows.map(normalizeSensor).filter((sensor) => sensor.sensorUid && ['CO2', 'MULTI'].includes(sensor.sensorType));
}

async function queryInfluxMetrics(sensorUid) {
  const bucket = process.env.INFLUX_BUCKET || 'co2_data';
  const flux = `
    data = from(bucket: "${bucket}")
      |> range(start: -24h)
      |> filter(fn: (r) => r._measurement == "co2_readings")
      |> filter(fn: (r) => r.sensorId == "${sensorUid}" or r.sensor_uid == "${sensorUid}" or r.device == "${sensorUid}")
      |> filter(fn: (r) => r._field == "value" or r._field == "co2_value")

    avg = data |> mean() |> map(fn: (r) => ({ r with metric: "average" }))
    last = data |> last() |> map(fn: (r) => ({ r with metric: "current" }))
    minv = data |> min() |> map(fn: (r) => ({ r with metric: "min" }))
    maxv = data |> max() |> map(fn: (r) => ({ r with metric: "max" }))

    union(tables: [avg, last, minv, maxv])
      |> keep(columns: ["metric", "_value", "_time"])
  `;

  const rows = await queryFluxRows(flux);
  const out = { average: null, current: null, min: null, max: null, lastTime: null, sampleCount: 0 };

  for (const row of rows) {
    const value = toNumber(row._value);
    if (value === null) continue;
    if (row.metric === 'average') out.average = value;
    if (row.metric === 'current') {
      out.current = value;
      out.lastTime = row._time || null;
    }
    if (row.metric === 'min') out.min = value;
    if (row.metric === 'max') out.max = value;
    out.sampleCount += 1;
  }

  return out;
}

async function queryFallbackMetrics(sensorUid) {
  const points = await queryHistoricalDataResilient(sensorUid, '-24h').catch(() => []);
  const values = points.map((point) => toNumber(point.value)).filter((value) => value !== null);
  if (!values.length) {
    return { average: null, current: null, min: null, max: null, lastTime: null, sampleCount: 0 };
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    average,
    current: values[values.length - 1],
    min: Math.min(...values),
    max: Math.max(...values),
    lastTime: points[points.length - 1]?.time || null,
    sampleCount: values.length
  };
}

async function getSensorMetrics(sensorUid) {
  let raw;
  try {
    raw = await queryInfluxMetrics(sensorUid);
  } catch (err) {
    console.warn(`[optimization] Influx indisponible pour ${sensorUid}: ${err.message}`);
    raw = await queryFallbackMetrics(sensorUid);
  }

  const min = toNumber(raw.min);
  const max = toNumber(raw.max);
  const average = toNumber(raw.average);
  const current = toNumber(raw.current);
  const variation = min !== null && max !== null ? max - min : null;

  return {
    currentPpm: current !== null ? Math.round(current) : null,
    averagePpm: round(average, 1),
    minPpm: min !== null ? Math.round(min) : null,
    maxPpm: max !== null ? Math.round(max) : null,
    variationPpm: round(variation, 1),
    sampleCount: raw.sampleCount || 0,
    lastTime: raw.lastTime || null
  };
}

function minutesSince(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.round((Date.now() - time) / 60000));
}

function analyzeSensor(sensor, metrics, globalAverage) {
  const anomalies = [];
  const current = toNumber(metrics.currentPpm);
  const average = toNumber(metrics.averagePpm);
  const variation = toNumber(metrics.variationPpm);
  const staleMinutes = minutesSince(metrics.lastTime);

  if (current === null || current <= 0 || staleMinutes === null || staleMinutes > STALE_MINUTES) {
    anomalies.push({
      severity: 'critical',
      title: 'Alerte Angle Mort',
      message: `${sensor.name} ne transmet pas de mesure récente. Vérifiez le module et sa position.`
    });
  }

  if (average !== null && average >= LOW_CONSTANT_MIN && average <= LOW_CONSTANT_MAX && variation !== null && variation <= VERY_LOW_VARIATION) {
    anomalies.push({
      severity: 'warning',
      title: 'Alerte Angle Mort',
      message: `${sensor.name} présente une lecture presque figée proche de l’air extérieur. Déplacez-le hors du flux direct de ventilation.`
    });
  }

  if (average !== null && average >= HIGH_AVERAGE && variation !== null && variation <= LOW_VARIATION) {
    anomalies.push({
      severity: 'critical',
      title: 'Alerte Angle Mort',
      message: `${sensor.name} détecte une accumulation persistante. Déplacez-le vers une zone de circulation d’air ou augmentez la couverture autour de ${sensor.zone}.`
    });
  }

  if (average !== null && globalAverage !== null && Math.abs(average - globalAverage) > 450 && variation !== null && variation < 50) {
    anomalies.push({
      severity: 'warning',
      title: 'Alerte Angle Mort',
      message: `${sensor.name} diverge fortement des autres capteurs. Vérifiez son emplacement et son exposition locale.`
    });
  }

  return anomalies;
}

function distanceMeters(a, b) {
  const lat1 = toNumber(a.latitude);
  const lng1 = toNumber(a.longitude);
  const lat2 = toNumber(b.latitude);
  const lng2 = toNumber(b.longitude);
  if ([lat1, lng1, lat2, lng2].some((value) => value === null)) return null;

  const earth = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

function computeCoverage(sensors) {
  if (!sensors.length) return 0;
  const healthyRatio = sensors.filter((sensor) => sensor.placementStatus === 'good').length / sensors.length;

  let spacingRatio = 1;
  if (sensors.length > 1) {
    const distances = [];
    for (let i = 0; i < sensors.length; i += 1) {
      for (let j = i + 1; j < sensors.length; j += 1) {
        const d = distanceMeters(sensors[i], sensors[j]);
        if (d !== null) distances.push(d);
      }
    }
    const averageDistance = distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : 0;
    spacingRatio = Math.max(0.25, Math.min(1, averageDistance / 20));
  }

  return Math.round((healthyRatio * 0.72 + spacingRatio * 0.28) * 100);
}

function buildRecommendations(sensors, anomalies, coverageRate) {
  if (!sensors.length) return [];
  const messages = anomalies.slice(0, 4).map((item) => item.message);
  if (coverageRate < 70) {
    messages.push('La couverture spatiale est insuffisante. Répartissez les capteurs sur les zones de travail et les points de circulation.');
  }
  if (!messages.length) {
    messages.push('Le placement actuel est cohérent. Les capteurs couvrent correctement les zones suivies.');
  }
  return messages;
}

async function getOptimizationStatus(user) {
  const configured = await getConfiguredSensors(user);
  const withMetrics = [];

  for (const sensor of configured) {
    const metrics = await getSensorMetrics(sensor.sensorUid);
    withMetrics.push({ ...sensor, ...metrics });
  }

  const averages = withMetrics.map((sensor) => toNumber(sensor.averagePpm)).filter((value) => value !== null);
  const globalAverage = averages.length ? round(averages.reduce((sum, value) => sum + value, 0) / averages.length, 1) : null;

  const sensors = [];
  const anomalies = [];

  for (const sensor of withMetrics) {
    const sensorAnomalies = analyzeSensor(sensor, sensor, globalAverage).map((item, index) => ({
      id: `${sensor.id}-${index}`,
      sensorKey: sensor.sensorUid,
      sensorName: sensor.name,
      zone: sensor.zone,
      severity: item.severity,
      title: item.title,
      message: item.message
    }));

    const hasCritical = sensorAnomalies.some((item) => item.severity === 'critical');
    const hasWarning = sensorAnomalies.length > 0;
    const current = toNumber(sensor.currentPpm);

    const co2Level = current === null
      ? 'offline'
      : current > 1000
        ? 'high'
        : current >= 800
          ? 'medium'
          : 'normal';

    const placementStatus = hasCritical || co2Level === 'offline'
      ? 'critical'
      : hasWarning
        ? 'warning'
        : 'good';

    anomalies.push(...sensorAnomalies);
    sensors.push({
      key: sensor.sensorUid,
      name: sensor.name,
      zone: sensor.zone,
      latitude: sensor.latitude,
      longitude: sensor.longitude,
      positionX: sensor.positionX,
      positionY: sensor.positionY,
      currentPpm: sensor.currentPpm,
      averagePpm: sensor.averagePpm,
      variationPpm: sensor.variationPpm,
      sampleCount: sensor.sampleCount,
      lastTime: sensor.lastTime,
      co2Level,
      placementStatus,
      placementLabel: placementStatus === 'good' ? 'Bien positionné' : 'Alerte Angle Mort',
      operationalStatus: co2Level === 'offline' ? 'Hors ligne' : 'Opérationnel',
      anomalies: sensorAnomalies.map((item) => ({ title: item.title, message: item.message, severity: item.severity }))
    });
  }

  const coverageRate = computeCoverage(sensors);
  const recommendations = buildRecommendations(sensors, anomalies, coverageRate);

  return {
    sensors,
    coverageRate,
    placementStatus: anomalies.length ? 'Surveillance requise' : 'Optimal',
    activeSensorCount: sensors.length,
    anomalies,
    recommendations,
    metrics: {
      globalAverage,
      generatedAt: new Date().toISOString()
    }
  };
}

function resolveCompanyId(user) {
  const companyId = user?.activeCompanyId ? Number(user.activeCompanyId) : null;
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new HttpError(400, 'companyId requis (token)', 'VALIDATION_ERROR');
  }
  return companyId;
}

function safeId(id) {
  const v = String(id || '').trim();
  if (!/^\d+$/.test(v)) throw new HttpError(400, 'id invalide', 'VALIDATION_ERROR');
  return v;
}

function stats(values) {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return { mean: 0, stddev: 0, n: 0 };
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const variance = v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length;
  return { mean, stddev: Math.sqrt(variance), n: v.length };
}

function normalize01(x, min, max) {
  if (!Number.isFinite(x)) return 0;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return 0.5;
  return Math.max(0, Math.min(1, (x - min) / (max - min)));
}

async function getPositioningHistory(user) {
  const companyId = resolveCompanyId(user);
  const positions = await PositioningPosition.findAll({
    where: { companyId },
    order: [['created_at', 'DESC']]
  });

  const bucket = process.env.INFLUX_BUCKET || 'co2_data';
  const result = [];

  for (const pos of positions) {
    const positionId = String(pos.id);
    const durationMinutes = Math.max(5, Math.min(Number(pos.durationMinutes) || 30, 240));

    try {
      const fluxQuery = `
        from(bucket: "${bucket}")
          |> range(start: -${durationMinutes}m)
          |> filter(fn: (r) => r._measurement == "co2_readings")
          |> filter(fn: (r) => r._field == "value")
          |> filter(fn: (r) => (r.positionId == "${positionId}" or r.position_id == "${positionId}"))
          |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
          |> keep(columns: ["_time","_value"])
          |> sort(columns: ["_time"])
      `;

      const points = await queryFluxRows(fluxQuery);
      const values = points.map((p) => Number(p._value)).filter((n) => Number.isFinite(n));
      const s = stats(values);

      let spikes = 0;
      const spikeDelta = 120;
      for (let i = 1; i < values.length; i += 1) {
        if (Math.abs(values[i] - values[i - 1]) >= spikeDelta) spikes += 1;
      }
      const interferenceRate = values.length > 1 ? spikes / (values.length - 1) : 0;

      result.push({
        id: pos.id,
        name: pos.name,
        zone: pos.zone,
        durationMinutes: pos.durationMinutes,
        createdAt: pos.createdAt,
        updatedAt: pos.updatedAt,
        isFinal: pos.isFinal,
        finalizedAt: pos.finalizedAt,
        metrics: {
          meanPpm: Number(s.mean.toFixed(2)),
          stddevPpm: Number(s.stddev.toFixed(2)),
          points: s.n,
          interferenceRate: Number((interferenceRate * 100).toFixed(1))
        }
      });
    } catch (err) {
      result.push({
        id: pos.id,
        name: pos.name,
        zone: pos.zone,
        durationMinutes: pos.durationMinutes,
        createdAt: pos.createdAt,
        updatedAt: pos.updatedAt,
        isFinal: pos.isFinal,
        finalizedAt: pos.finalizedAt,
        metrics: {
          meanPpm: null,
          stddevPpm: null,
          points: 0,
          interferenceRate: null,
          error: 'Données InfluxDB indisponibles'
        }
      });
    }
  }

  if (result.length >= 2) {
    const means = result.filter((r) => r.metrics.meanPpm !== null).map((r) => r.metrics.meanPpm);
    const stds = result.filter((r) => r.metrics.stddevPpm !== null).map((r) => r.metrics.stddevPpm);
    const minMean = means.length ? Math.min(...means) : 0;
    const maxMean = means.length ? Math.max(...means) : 1000;
    const maxStd = stds.length ? Math.max(...stds, 0.00001) : 0.00001;

    for (const item of result) {
      if (item.metrics.meanPpm !== null) {
        const m = item.metrics;
        m.co2Capture = Math.round(normalize01(m.meanPpm, minMean, maxMean) * 100);
        m.stability = Math.round((1 - Math.min(1, m.stddevPpm / maxStd)) * 100);
        m.interference = Math.round((1 - Math.min(1, m.interferenceRate / 100)) * 100);
        m.score = Math.round(0.45 * m.co2Capture + 0.35 * m.stability + 0.20 * m.interference);
        m.confidence = Math.max(50, Math.min(99.9, m.score + 2.5));
      }
    }
  }

  return result;
}

async function getPositionDetail(positionId, user) {
  const companyId = resolveCompanyId(user);
  const pid = safeId(positionId);

  const pos = await PositioningPosition.findOne({
    where: { id: pid, companyId }
  });

  if (!pos) {
    throw new HttpError(404, 'Position introuvable', 'NOT_FOUND');
  }

  const bucket = process.env.INFLUX_BUCKET || 'co2_data';
  const durationMinutes = Math.max(5, Math.min(Number(pos.durationMinutes) || 30, 240));

  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: -${durationMinutes}m)
      |> filter(fn: (r) => r._measurement == "co2_readings")
      |> filter(fn: (r) => r._field == "value")
      |> filter(fn: (r) => (r.positionId == "${pid}" or r.position_id == "${pid}"))
      |> sort(columns: ["_time"])
  `;

  let timeSeries = [];
  try {
    const points = await queryFluxRows(fluxQuery);
    timeSeries = points
      .map((p) => ({ time: p._time, ppm: Number(p._value) }))
      .filter((p) => Number.isFinite(p.ppm));
  } catch (err) {
    console.warn(`[optimization] Impossible de charger détail position ${pid}: ${err.message}`);
  }

  const createdMs = new Date(pos.createdAt).getTime();
  const updatedMs = new Date(pos.updatedAt).getTime();
  const sessionDurationMs = updatedMs - createdMs;
  const sessionDurationMinutes = Math.round(sessionDurationMs / 60000);
  const hours = Math.floor(sessionDurationMinutes / 60);
  const minutes = sessionDurationMinutes % 60;
  const durationLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return {
    id: pos.id,
    name: pos.name,
    zone: pos.zone,
    description: `Session d'audit à "${pos.zone}"`,
    durationMinutes: pos.durationMinutes,
    sessionStarted: pos.createdAt,
    sessionEnded: pos.updatedAt,
    sessionDurationMinutes,
    sessionDurationLabel: durationLabel,
    isFinal: pos.isFinal,
    finalizedAt: pos.finalizedAt,
    dataPoints: timeSeries.length,
    timeSeries,
    summary: {
      pointCount: timeSeries.length,
      startTime: pos.createdAt,
      endTime: pos.updatedAt
    }
  };
}

async function createPositioningSession(payload, user) {
  const companyId = resolveCompanyId(user);

  const name = String(payload?.name || '').trim();
  const zone = String(payload?.zone || '').trim();
  const durationMinutes = Math.max(5, Math.min(Number(payload?.durationMinutes) || 30, 240));

  if (!name || !zone) {
    throw new HttpError(400, 'name et zone requis', 'VALIDATION_ERROR');
  }

  const created = await PositioningPosition.create({
    companyId,
    name,
    zone,
    durationMinutes
  });

  return {
    id: created.id,
    name: created.name,
    zone: created.zone,
    durationMinutes: created.durationMinutes,
    createdAt: created.createdAt,
    isFinal: created.isFinal
  };
}

async function deletePositioningSession(sessionId, user) {
  const companyId = resolveCompanyId(user);
  const sid = safeId(sessionId);

  const row = await PositioningPosition.findOne({
    where: { id: sid, companyId }
  });

  if (!row) {
    throw new HttpError(404, 'Session introuvable', 'NOT_FOUND');
  }

  await row.destroy();
  return true;
}

async function getBeaconStatus(user) {
  const companyId = resolveCompanyId(user);
  const bucket = process.env.INFLUX_BUCKET || 'co2_data';

  try {
    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: -30m)
        |> filter(fn: (r) => r._measurement == "co2_readings")
        |> filter(fn: (r) => r._field == "value" or r._field == "battery" or r._field == "wifiRssi")
        |> last()
        |> group(columns: ["_field"])
    `;

    const rows = await queryFluxRows(fluxQuery);
    const fields = { value: null, battery: null, wifiRssi: null, lastTime: null };

    for (const r of rows) {
      const f = r._field;
      const v = Number(r._value);
      if (Number.isFinite(v)) fields[f] = v;
      if (!fields.lastTime && r._time) fields.lastTime = r._time;
    }

    const lastPositions = await PositioningPosition.findAll({
      where: { companyId },
      order: [['createdAt', 'DESC']],
      limit: 1
    });

    const activePos = lastPositions[0] || null;
    const hasSignal = fields.value !== null;

    return {
      online: hasSignal,
      currentPpm: fields.value !== null ? Math.round(fields.value) : null,
      battery: fields.battery !== null ? Math.round(fields.battery) : null,
      signalStrength: fields.wifiRssi !== null ? Math.round(fields.wifiRssi) : null,
      zone: activePos ? activePos.zone : 'Balise hors ligne',
      positionName: activePos ? activePos.name : 'Aucune session active',
      lastUpdate: fields.lastTime || null,
      positionId: activePos ? activePos.id : null
    };
  } catch (err) {
    return {
      online: false,
      currentPpm: null,
      battery: null,
      signalStrength: null,
      zone: 'Balise hors ligne',
      positionName: 'Erreur de connexion',
      lastUpdate: null,
      positionId: null
    };
  }
}

module.exports = {
  getOptimizationStatus,
  getPositioningHistory,
  getPositionDetail,
  createPositioningSession,
  deletePositioningSession,
  getBeaconStatus
};
