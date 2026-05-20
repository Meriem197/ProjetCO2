/**
 * Statistiques Influx, classification qualite air, prediction (base IA — cahier des charges).
 */
const { queryHistoricalDataResilient, queryLastCo2Value, queryActiveSensorIds } = require('../services/influxService');
const mysqlService = require('../services/mysqlService');
const { classifyPpm, predictLinear } = require('../services/aiService');
const { successResponse } = require('../utils/apiResponse');
const { HttpError } = require('../utils/httpError');

function isValidStartRange(value) {
  return /^-\d+(ms|s|m|h|d|w)$/.test(value);
}

function isValidSensorId(value) {
  return typeof value === 'string' && /^[\w-]+$/.test(value);
}

async function resolveSensorIdOrFallback(requestedSensorId) {
  const clean = typeof requestedSensorId === 'string' ? requestedSensorId.trim() : '';
  if (clean) return clean;
  const active = (await queryActiveSensorIds('-30d')).filter((id) => id && id !== 'unknown');
  return active[0] || '';
}

async function getCo2Stats(req, res, next) {
  const requestedSensorId = typeof req.query.sensorId === 'string' ? req.query.sensorId.trim() : '';
  const start = typeof req.query.start === 'string' ? req.query.start.trim() : '-24h';
  if (!isValidStartRange(start)) {
    return next(new HttpError(400, 'start invalide (ex: -24h)', 'VALIDATION_ERROR'));
  }
  try {
    const sensorId = await resolveSensorIdOrFallback(requestedSensorId);
    if (!sensorId) return next(new HttpError(404, 'Aucun capteur actif detecte dans InfluxDB', 'NO_ACTIVE_SENSOR'));
    if (!isValidSensorId(sensorId)) {
      return next(new HttpError(400, 'sensorId invalide', 'VALIDATION_ERROR'));
    }
    const points = await queryHistoricalDataResilient(sensorId, start);
    if (points.length === 0) {
      return res.json(successResponse({ min: null, max: null, mean: null, count: 0, sensorId, start }));
    }
    const values = points.map((p) => Number(p.value)).filter((x) => Number.isFinite(x));
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return res.json(
      successResponse({
        min,
        max,
        mean: Math.round(mean * 10) / 10,
        count: values.length,
        sensorId,
        start
      })
    );
  } catch (err) {
    return next(err);
  }
}

async function classify(req, res, next) {
  try {
    if (req.query.value !== undefined && req.query.value !== '') {
      const classification = classifyPpm(Number(req.query.value));
      return res.json(successResponse(classification));
    }
    const requestedSensorId = typeof req.query.sensorId === 'string' ? req.query.sensorId.trim() : '';
    const sensorId = await resolveSensorIdOrFallback(requestedSensorId);
    if (!sensorId) {
      return next(new HttpError(400, 'Fournir value=ppm ou sensorId=', 'VALIDATION_ERROR'));
    }
    if (!isValidSensorId(sensorId)) {
      return next(new HttpError(400, 'sensorId invalide', 'VALIDATION_ERROR'));
    }
    let last = null;
    try {
      last = await queryLastCo2Value(sensorId);
    } catch (err) {
      console.warn(`[analytics] fallback last value from MySQL for ${sensorId}: ${err.message}`);
    }
    if (!last) {
      const fallback = await queryHistoricalDataResilient(sensorId, '-2h');
      last = fallback.length ? fallback[fallback.length - 1] : null;
    }
    if (!last) {
      return res.json(successResponse({ classification: null, message: 'Aucune mesure recente' }));
    }
    const classification = classifyPpm(last.value);
    return res.json(successResponse({ ...classification, lastTime: last.time }));
  } catch (err) {
    return next(err);
  }
}

async function predict(req, res, next) {
  const requestedSensorId = typeof req.query.sensorId === 'string' ? req.query.sensorId.trim() : '';
  const horizon = parseInt(req.query.horizonMinutes, 10) || 30;
  try {
    const sensorId = await resolveSensorIdOrFallback(requestedSensorId);
    if (!sensorId) return next(new HttpError(404, 'Aucun capteur actif detecte dans InfluxDB', 'NO_ACTIVE_SENSOR'));
    if (!isValidSensorId(sensorId)) {
      return next(new HttpError(400, 'sensorId invalide', 'VALIDATION_ERROR'));
    }
    const points = await queryHistoricalDataResilient(sensorId, '-48h');
    const prediction = predictLinear(points, horizon);
    return res.json(successResponse({ sensorId, ...prediction }));
  } catch (err) {
    return next(err);
  }
}

async function getPlacementOptimization(req, res, next) {
  try {
    const rows = await mysqlService.listSensors({}, req.user);
    const sensors = [];
    for (const row of rows) {
      const s = row.toJSON ? row.toJSON() : row;
      const site = s.edgeDevice?.productionLine?.site || null;
      if (!site || site.latitude == null || site.longitude == null) continue;
      let ppm = null;
      try {
        const last = await queryLastCo2Value(s.sensorUid);
        ppm = last?.value != null ? Number(last.value) : null;
      } catch (_err) {}
      sensors.push({
        id: s.id,
        sensorUid: s.sensorUid,
        name: s.name,
        ppm,
        siteId: site.id,
        zone: site.name,
        city: site.city,
        lat: Number(site.latitude),
        lng: Number(site.longitude)
      });
    }

    const candidates = sensors.map((item) => {
      const normalizedPpm = Number.isFinite(item.ppm) ? item.ppm : 800;
      const exposureRisk = Math.min(1, Math.max(0, normalizedPpm / 2000));
      const ventilationScore = Math.max(0.2, 1 - exposureRisk);
      const distanceScore = 0.8;
      const score = (ventilationScore * 0.5 + distanceScore * 0.3 + (1 - exposureRisk) * 0.2) * 100;
      return { ...item, ventilationScore, exposureRisk, distanceScore, score: Math.round(score * 10) / 10 };
    });
    const ranked = candidates.sort((a, b) => b.score - a.score);

    return res.json(
      successResponse({
        model: 'PlacementRanker-v1',
        sensorCount: sensors.length,
        evaluatedAt: new Date().toISOString(),
        weights: {
          ventilationScore: 0.5,
          distanceScore: 0.3,
          inverseExposureRisk: 0.2
        },
        recommendedZone: ranked[0]?.zone || null,
        candidates: ranked
      })
    );
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getCo2Stats,
  classify,
  predict,
  getPlacementOptimization
};
